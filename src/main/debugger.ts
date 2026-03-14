import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { dirname, basename } from 'path'

let gdbProcess: ChildProcess | null = null
let gdbBuffer = ''
let tokenCounter = 0

function sendGdb(cmd: string): number {
  const token = ++tokenCounter
  gdbProcess?.stdin?.write(`${token}${cmd}\n`)
  return token
}

function parseGdbMI(line: string, mainWindow: BrowserWindow): void {
  // GDB/MI output records
  if (line.startsWith('*stopped')) {
    const reason = line.match(/reason="([^"]*)"/)
    const file = line.match(/fullname="([^"]*)"/)
    const lineNum = line.match(/line="(\d+)"/)
    mainWindow.webContents.send('debug:stopped', {
      reason: reason?.[1] || 'unknown',
      file: file?.[1] || '',
      line: lineNum ? parseInt(lineNum[1]) : 0
    })
    // Request local variables
    sendGdb('-stack-list-variables --simple-values')
  } else if (line.startsWith('*running')) {
    // program is running
  } else if (line.includes('^done,variables=')) {
    const varsMatch = line.match(/variables=\[(.*)\]/)
    if (varsMatch) {
      const vars: { name: string; value: string; type: string }[] = []
      const varPattern = /\{name="([^"]*)",(?:arg="[^"]*",)?type="([^"]*)",value="([^"]*)"\}/g
      let m
      while ((m = varPattern.exec(varsMatch[1])) !== null) {
        vars.push({ name: m[1], type: m[2], value: m[3] })
      }
      mainWindow.webContents.send('debug:variables', vars)
    }
  } else if (line.startsWith('~"')) {
    // Console output
    const text = line.slice(2, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"')
    mainWindow.webContents.send('debug:output', text)
  } else if (line.includes('^exit') || line.includes('^error')) {
    mainWindow.webContents.send('debug:exited')
  }
}

export function setupDebugHandlers(mainWindow: BrowserWindow): void {
  ipcMain.on('debug:start', async (_, filePath: string) => {
    if (gdbProcess) { gdbProcess.kill(); gdbProcess = null }
    gdbBuffer = ''
    tokenCounter = 0

    // First compile with -e to keep emitted C and debug symbols
    const compileProc = spawn('axe', [filePath, '-e'], {
      cwd: dirname(filePath),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    compileProc.on('close', (code) => {
      if (code !== 0) {
        mainWindow.webContents.send('debug:output', 'Compilation failed\n')
        mainWindow.webContents.send('debug:exited')
        return
      }

      // Executable name = filename without extension
      const exeName = basename(filePath, '.axe') + (process.platform === 'win32' ? '.exe' : '')
      const exePath = dirname(filePath) + '/' + exeName

      gdbProcess = spawn('gdb', ['--interpreter=mi', exePath], {
        cwd: dirname(filePath),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      gdbProcess.stdout?.on('data', (d: Buffer) => {
        gdbBuffer += d.toString()
        const lines = gdbBuffer.split('\n')
        gdbBuffer = lines.pop() || ''
        for (const line of lines) {
          if (line.trim()) parseGdbMI(line.trim(), mainWindow)
        }
      })

      gdbProcess.stderr?.on('data', (d: Buffer) => {
        mainWindow.webContents.send('debug:output', d.toString())
      })

      gdbProcess.on('exit', () => {
        mainWindow.webContents.send('debug:exited')
        gdbProcess = null
      })

      gdbProcess.on('error', (err) => {
        mainWindow.webContents.send('debug:output', `GDB error: ${err.message}\n`)
        mainWindow.webContents.send('debug:exited')
        gdbProcess = null
      })
    })

    compileProc.stderr?.on('data', (d: Buffer) => {
      mainWindow.webContents.send('debug:output', d.toString())
    })
  })

  ipcMain.on('debug:stop', () => { if (gdbProcess) { gdbProcess.kill(); gdbProcess = null } })
  ipcMain.on('debug:breakpoint:set', (_, file: string, line: number) => sendGdb(`-break-insert ${file}:${line}`))
  ipcMain.on('debug:breakpoint:remove', (_, file: string, line: number) => sendGdb(`-break-delete ${file}:${line}`))
  ipcMain.on('debug:continue', () => sendGdb('-exec-continue'))
  ipcMain.on('debug:stepOver', () => sendGdb('-exec-next'))
  ipcMain.on('debug:stepIn', () => sendGdb('-exec-step'))
  ipcMain.on('debug:stepOut', () => sendGdb('-exec-finish'))
}
