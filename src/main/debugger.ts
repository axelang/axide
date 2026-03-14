import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { dirname, basename } from 'path'
import { loadSettings } from './settings'

let gdbProcess: ChildProcess | null = null
let gdbBuffer = ''
let tokenCounter = 0

const gdbBreakpointNumbers: Map<string, number> = new Map()

let pendingBreakpoints: { file: string; line: number }[] = []
let gdbReady = false

function sendGdb(cmd: string): number {
  const token = ++tokenCounter
  gdbProcess?.stdin?.write(`${token}${cmd}\n`)
  return token
}

function parseGdbMI(line: string, mainWindow: BrowserWindow): void {
  if (line.startsWith('*stopped')) {
    const reason = line.match(/reason="([^"]*)"/)
    const file = line.match(/fullname="([^"]*)"/)
    const lineNum = line.match(/line="(\d+)"/)
    mainWindow.webContents.send('debug:stopped', {
      reason: reason?.[1] || 'unknown',
      file: file?.[1] || '',
      line: lineNum ? parseInt(lineNum[1]) : 0
    })
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
  } else if (line.includes('^done,bkpt=')) {
    const numMatch = line.match(/bkpt=\{number="(\d+)"/)
    let fileMatch = line.match(/fullname="([^"]*)"/) || line.match(/file="([^"]*)"/)
    const lineMatch = line.match(/line="(\d+)"/)
    if (numMatch && fileMatch && lineMatch) {
      const normFile = fileMatch[1].replace(/\\/g, '/')
      const key = `${normFile}:${lineMatch[1]}`
      gdbBreakpointNumbers.set(key, parseInt(numMatch[1]))
    }
  } else if (line.startsWith('~"')) {
    const text = line.slice(2, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"')
    mainWindow.webContents.send('debug:output', text)
  } else if (line.includes('^exit') || line.includes('^error')) {
    if (line.includes('^error')) {
      const msg = line.match(/msg="([^"]*)"/)
      if (msg) {
        mainWindow.webContents.send('debug:output', `GDB error: ${msg[1]}\n`)
      }
    }
    mainWindow.webContents.send('debug:exited')
  }

  if (line.includes('(gdb)') && !gdbReady) {
    gdbReady = true
    for (const bp of pendingBreakpoints) {
      sendGdb(`-break-insert -f "${bp.file}:${bp.line}"`)
    }
    pendingBreakpoints = []
    sendGdb('-exec-run')
  }
}

export function setupDebugHandlers(mainWindow: BrowserWindow): void {
  ipcMain.on('debug:start', async (_, filePath: string) => {
    if (gdbProcess) { gdbProcess.kill(); gdbProcess = null }
    gdbBuffer = ''
    tokenCounter = 0
    gdbBreakpointNumbers.clear()
    gdbReady = false

    const compileProc = spawn('axe', [filePath, '-e', '--cflags', '"-g"'], {
      cwd: dirname(filePath),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    compileProc.on('close', (code) => {
      if (code !== 0) {
        mainWindow.webContents.send('debug:output', 'Compilation failed\n')
        mainWindow.webContents.send('debug:exited')
        return
      }

      const exeName = basename(filePath, '.axe') + (process.platform === 'win32' ? '.exe' : '')
      const exePath = dirname(filePath) + '/' + exeName

      loadSettings().then(settings => {
        gdbProcess = spawn(settings.gdbPath, ['--interpreter=mi', exePath], {
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
          gdbReady = false
        })

        gdbProcess.on('error', (err) => {
          mainWindow.webContents.send('debug:output', `GDB/LLDB error: ${err.message}\n`)
          mainWindow.webContents.send('debug:exited')
          gdbProcess = null
          gdbReady = false
        })
      })
    })

    compileProc.stderr?.on('data', (d: Buffer) => {
      mainWindow.webContents.send('debug:output', d.toString())
    })
  })

  ipcMain.on('debug:stop', () => {
    if (gdbProcess) { gdbProcess.kill(); gdbProcess = null; gdbReady = false }
  })

  ipcMain.on('debug:breakpoint:set', (_, file: string, line: number) => {
    const normFile = file.replace(/\\/g, '/')
    if (gdbProcess && gdbReady) {
      sendGdb(`-break-insert -f "${normFile}:${line}"`)
    } else {
      pendingBreakpoints.push({ file: normFile, line })
    }
  })

  ipcMain.on('debug:breakpoint:remove', (_, file: string, line: number) => {
    const normFile = file.replace(/\\/g, '/')
    const key = `${normFile}:${line}`
    const bpNum = gdbBreakpointNumbers.get(key)
    if (bpNum !== undefined && gdbProcess && gdbReady) {
      sendGdb(`-break-delete ${bpNum}`)
      gdbBreakpointNumbers.delete(key)
    }
    pendingBreakpoints = pendingBreakpoints.filter(bp => !(bp.file === normFile && bp.line === line))
  })

  ipcMain.on('debug:breakpoints:set-all', (_, breakpoints: { file: string; line: number }[]) => {
    pendingBreakpoints = breakpoints.map(bp => ({ file: bp.file.replace(/\\/g, '/'), line: bp.line }))
  })

  ipcMain.on('debug:continue', () => sendGdb('-exec-continue'))
  ipcMain.on('debug:stepOver', () => sendGdb('-exec-next'))
  ipcMain.on('debug:stepIn', () => sendGdb('-exec-step'))
  ipcMain.on('debug:stepOut', () => sendGdb('-exec-finish'))
}
