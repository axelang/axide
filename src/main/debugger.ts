import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { dirname, basename, join } from 'path'
import { loadSettings } from './settings'

interface Debugger {
  start(filePath: string, initialBreakpoints: { file: string; line: number }[]): Promise<void>
  stop(): void
  setBreakpoint(file: string, line: number): void
  removeBreakpoint(file: string, line: number): void
  setAllBreakpoints(bps: { file: string; line: number }[]): void
  continue(): void
  stepOver(): void
  stepIn(): void
  stepOut(): void
}

let activeDebugger: Debugger | null = null
let globalBreakpoints: { file: string; line: number }[] = []

class GdbMiDebugger implements Debugger {
  private gdbProcess: ChildProcess | null = null
  private gdbBuffer = ''
  private tokenCounter = 0
  private gdbBreakpointNumbers: Map<string, number> = new Map()
  private pendingBreakpoints: { file: string; line: number }[] = []
  private gdbReady = false

  constructor(private mainWindow: BrowserWindow, private debuggerPath: string) { }

  async start(filePath: string, initialBreakpoints: { file: string; line: number }[]): Promise<void> {
    this.pendingBreakpoints = initialBreakpoints.map(bp => ({ file: bp.file.replace(/\\/g, '/'), line: bp.line }))
    const exeName = basename(filePath, '.axe') + (process.platform === 'win32' ? '.exe' : '')

    this.gdbProcess = spawn(this.debuggerPath, ['--interpreter=mi', './' + exeName], {
      cwd: dirname(filePath),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.gdbProcess.stdout?.on('data', (d: Buffer) => {
      this.gdbBuffer += d.toString()
      const lines = this.gdbBuffer.split('\n')
      this.gdbBuffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) this.parseGdbMI(line.trim())
      }
    })

    this.gdbProcess.stderr?.on('data', (d: Buffer) => {
      this.mainWindow.webContents.send('debug:output', d.toString())
    })

    this.gdbProcess.on('exit', () => {
      this.mainWindow.webContents.send('debug:exited')
      this.gdbProcess = null
      this.gdbReady = false
      if (activeDebugger === this) activeDebugger = null
    })

    this.gdbProcess.on('error', (err) => {
      this.mainWindow.webContents.send('debug:output', `Debugger error: ${err.message}\n`)
      this.mainWindow.webContents.send('debug:exited')
    })
  }

  private sendGdb(cmd: string): number {
    const token = ++this.tokenCounter
    this.gdbProcess?.stdin?.write(`${token}${cmd}\n`)
    return token
  }

  private parseGdbMI(line: string): void {
    if (line.startsWith('*stopped')) {
      const reason = line.match(/reason="([^"]*)"/)
      const file = line.match(/fullname="([^"]*)"/)
      const lineNum = line.match(/line="(\d+)"/)
      this.mainWindow.webContents.send('debug:stopped', {
        reason: reason?.[1] || 'unknown',
        file: file?.[1] || '',
        line: lineNum ? parseInt(lineNum[1]) : 0
      })
      this.sendGdb('-stack-list-variables --simple-values')
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
        this.mainWindow.webContents.send('debug:variables', vars)
      }
    } else if (line.includes('^done,bkpt=')) {
      const numMatch = line.match(/bkpt=\{number="(\d+)"/)
      let fileMatch = line.match(/fullname="([^"]*)"/) || line.match(/file="([^"]*)"/)
      const lineMatch = line.match(/line="(\d+)"/)
      if (numMatch && fileMatch && lineMatch) {
        const normFile = fileMatch[1].replace(/\\/g, '/')
        const key = `${normFile}:${lineMatch[1]}`
        this.gdbBreakpointNumbers.set(key, parseInt(numMatch[1]))
      }
    } else if (line.startsWith('~"')) {
      const text = line.slice(2, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"')
      this.mainWindow.webContents.send('debug:output', text)
    } else if (line.includes('^exit') || line.includes('^error')) {
      if (line.includes('^error')) {
        const msg = line.match(/msg="([^"]*)"/)
        if (msg) {
          this.mainWindow.webContents.send('debug:output', `GDB error: ${msg[1]}\n`)
        }
      }
    }

    if (line.includes('(gdb)') && !this.gdbReady) {
      this.gdbReady = true
      for (const bp of this.pendingBreakpoints) {
        this.sendGdb(`-break-insert -f "${bp.file}:${bp.line}"`)
      }
      this.pendingBreakpoints = []
      this.sendGdb('-exec-run')
    }
  }

  stop(): void { this.gdbProcess?.kill() }
  continue(): void { this.sendGdb('-exec-continue') }
  stepOver(): void { this.sendGdb('-exec-next') }
  stepIn(): void { this.sendGdb('-exec-step') }
  stepOut(): void { this.sendGdb('-exec-finish') }

  setBreakpoint(file: string, line: number): void {
    const normFile = file.replace(/\\/g, '/')
    if (this.gdbReady) {
      this.sendGdb(`-break-insert -f "${normFile}:${line}"`)
    } else {
      this.pendingBreakpoints.push({ file: normFile, line })
    }
  }

  removeBreakpoint(file: string, line: number): void {
    const normFile = file.replace(/\\/g, '/')
    const key = `${normFile}:${line}`
    const bpNum = this.gdbBreakpointNumbers.get(key)
    if (bpNum !== undefined && this.gdbReady) {
      this.sendGdb(`-break-delete ${bpNum}`)
      this.gdbBreakpointNumbers.delete(key)
    }
    this.pendingBreakpoints = this.pendingBreakpoints.filter(bp => !(bp.file === normFile && bp.line === line))
  }

  setAllBreakpoints(bps: { file: string; line: number }[]): void {
    this.pendingBreakpoints = bps.map(bp => ({ file: bp.file.replace(/\\/g, '/'), line: bp.line }))
    if (this.gdbReady) {
      // TODO: SYNC THE BREAKPOINTS
    }
  }
}

class DapDebugger implements Debugger {
  private process: ChildProcess | null = null
  private sequence = 0
  private pendingRequests = new Map<number, (res: any) => void>()
  private buffer = Buffer.alloc(0)
  private breakpoints: Map<string, number[]> = new Map()
  private stoppedThreadId: number | null = null

  constructor(private mainWindow: BrowserWindow, private debuggerPath: string) { }

  async start(filePath: string, initialBreakpoints: { file: string; line: number }[]): Promise<void> {
    for (const bp of initialBreakpoints) {
      const lines = this.breakpoints.get(bp.file) || []
      if (!lines.includes(bp.line)) lines.push(bp.line)
      this.breakpoints.set(bp.file, lines)
    }

    const exeName = basename(filePath, '.axe') + (process.platform === 'win32' ? '.exe' : '')
    const exePath = join(dirname(filePath), exeName)

    this.mainWindow.webContents.send('debug:output', `Starting DAP with: ${this.debuggerPath}\nBinary: ${exePath}\n`)

    this.process = spawn(this.debuggerPath, [], {
      cwd: dirname(filePath),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data])
      this.processBuffer()
    })

    this.process.stderr?.on('data', (d: Buffer) => {
      this.mainWindow.webContents.send('debug:output', `DAP stderr: ${d.toString()}`)
    })

    this.process.on('exit', (code) => {
      this.mainWindow.webContents.send('debug:output', `DAP process exited with code ${code}\n`)
      this.mainWindow.webContents.send('debug:exited')
      this.process = null
      if (activeDebugger === this) activeDebugger = null
    })

    this.process.on('error', (err) => {
      this.mainWindow.webContents.send('debug:output', `DAP spawn error: ${err.message}\n`)
      this.mainWindow.webContents.send('debug:exited')
    })

    await this.send('initialize', {
      adapterID: 'axe',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false
    })

    await this.send('launch', {
      program: exePath,
      args: [],
      cwd: dirname(filePath),
      stopOnEntry: true
    })
  }

  private processBuffer() {
    while (true) {
      const str = this.buffer.toString('utf8')
      const headerMatch = str.match(/Content-Length: (\d+)\r\n\r\n/)
      if (!headerMatch) break

      const length = parseInt(headerMatch[1])
      const headerLength = headerMatch[0].length
      if (this.buffer.length < headerLength + length) break

      const body = this.buffer.slice(headerLength, headerLength + length).toString('utf8')
      this.buffer = this.buffer.slice(headerLength + length)

      try {
        const msg = JSON.parse(body)
        if (msg.type === 'response') {
          const cb = this.pendingRequests.get(msg.request_seq)
          if (cb) {
            this.pendingRequests.delete(msg.request_seq)
            cb(msg)
          }
        } else if (msg.type === 'event') {
          this.handleEvent(msg)
        }
      } catch (e) {
        console.error('DAP parse error', e)
      }
    }
  }

  private async handleEvent(msg: any) {
    if (msg.event === 'initialized') {
      this.mainWindow.webContents.send('debug:output', 'DAP Initialized. Setting breakpoints...\n')
      for (const [file, lines] of this.breakpoints.entries()) {
        await this.send('setBreakpoints', {
          source: { path: file },
          breakpoints: lines.map(l => ({ line: l }))
        })
      }
      await this.send('configurationDone')
    } else if (msg.event === 'stopped') {
      this.stoppedThreadId = msg.body.threadId
      const stack = await this.send('stackTrace', { threadId: msg.body.threadId, levels: 1 })
      const topFrame = stack.body.stackFrames[0]
      if (topFrame) {
        this.mainWindow.webContents.send('debug:stopped', {
          reason: msg.body.reason,
          file: topFrame.source?.path || '',
          line: topFrame.line
        })
        this.fetchVariables(topFrame.id)
      }
    } else if (msg.event === 'output') {
      this.mainWindow.webContents.send('debug:output', msg.body.output)
    } else if (msg.event === 'terminated' || msg.event === 'exited') {
      this.mainWindow.webContents.send('debug:output', `DAP event: ${msg.event}\n`)
      this.mainWindow.webContents.send('debug:exited')
    }
  }

  private async fetchVariables(frameId: number) {
    try {
      const scopes = await this.send('scopes', { frameId })
      const vars: { name: string; value: string; type: string }[] = []

      for (const scope of scopes.body.scopes) {
        const variables = await this.send('variables', { variablesReference: scope.variablesReference })
        for (const v of variables.body.variables) {
          vars.push({ name: v.name, value: v.value, type: v.type || '' })
        }
      }
      this.mainWindow.webContents.send('debug:variables', vars)
    } catch (e) {
      this.mainWindow.webContents.send('debug:output', `Error fetching variables: ${e}\n`)
    }
  }

  private send(command: string, args: any = {}): Promise<any> {
    const seq = ++this.sequence
    const msgData = JSON.stringify({ seq, type: 'request', command, arguments: args })
    const payload = `Content-Length: ${Buffer.byteLength(msgData, 'utf8')}\r\n\r\n${msgData}`
    this.process?.stdin?.write(payload)
    return new Promise((resolve) => {
      this.pendingRequests.set(seq, resolve)
    })
  }

  stop(): void { this.send('disconnect', { restart: false }) }
  continue(): void { if (this.stoppedThreadId) this.send('continue', { threadId: this.stoppedThreadId }) }
  stepOver(): void { if (this.stoppedThreadId) this.send('next', { threadId: this.stoppedThreadId }) }
  stepIn(): void { if (this.stoppedThreadId) this.send('stepIn', { threadId: this.stoppedThreadId }) }
  stepOut(): void { if (this.stoppedThreadId) this.send('stepOut', { threadId: this.stoppedThreadId }) }

  setBreakpoint(file: string, line: number): void {
    const lines = this.breakpoints.get(file) || []
    if (!lines.includes(line)) {
      lines.push(line)
      this.breakpoints.set(file, lines)
      if (this.process) {
        this.send('setBreakpoints', {
          source: { path: file },
          breakpoints: lines.map(l => ({ line: l }))
        })
      }
    }
  }

  removeBreakpoint(file: string, line: number): void {
    let lines = this.breakpoints.get(file) || []
    if (lines.includes(line)) {
      lines = lines.filter(l => l !== line)
      this.breakpoints.set(file, lines)
      if (this.process) {
        this.send('setBreakpoints', {
          source: { path: file },
          breakpoints: lines.map(l => ({ line: l }))
        })
      }
    }
  }

  setAllBreakpoints(bps: { file: string; line: number }[]): void {
    this.breakpoints.clear()
    for (const bp of bps) {
      const lines = this.breakpoints.get(bp.file) || []
      lines.push(bp.line)
      this.breakpoints.set(bp.file, lines)
    }
    if (this.process) {
      for (const [file, lines] of this.breakpoints.entries()) {
        this.send('setBreakpoints', {
          source: { path: file },
          breakpoints: lines.map(l => ({ line: l }))
        })
      }
    }
  }
}

export function setupDebugHandlers(mainWindow: BrowserWindow): void {
  ipcMain.on('debug:start', async (_, filePath: string) => {
    if (activeDebugger) { activeDebugger.stop() }

    const settings = await loadSettings()

    const compileProc = spawn('axe', [basename(filePath), '-e', '--cflags=-g -gdwarf-4'], {
      cwd: dirname(filePath),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    let compileOutput = ''
    compileProc.stdout?.on('data', (d: Buffer) => { compileOutput += d.toString() })
    compileProc.stderr?.on('data', (d: Buffer) => { compileOutput += d.toString() })

    compileProc.on('close', async (code) => {
      if (code !== 0) {
        mainWindow.webContents.send('debug:output', 'Compilation failed: ' + code + '\nReason: ' + compileOutput)
        mainWindow.webContents.send('debug:exited')
        return
      }

      let debuggerPath = settings.debuggerPath
      if (process.platform === 'darwin' && debuggerPath === 'lldb-dap') {
        try {
          const { execSync } = require('child_process')
          debuggerPath = execSync('xcrun -f lldb-dap').toString().trim()
        } catch (e) {
          mainWindow.webContents.send('debug:output', 'Failed to resolve lldb-dap with xcrun. Ensure Xcode or Command Line Tools are installed.\n')
        }
      }

      if (debuggerPath.includes('dap')) {
        activeDebugger = new DapDebugger(mainWindow, debuggerPath)
      } else {
        activeDebugger = new GdbMiDebugger(mainWindow, debuggerPath)
      }

      await activeDebugger.start(filePath, globalBreakpoints)
    })
  })

  ipcMain.on('debug:stop', () => activeDebugger?.stop())
  ipcMain.on('debug:breakpoint:set', (_, file: string, line: number) => {
    const normFile = file.replace(/\\/g, '/')
    if (!globalBreakpoints.some(bp => bp.file === normFile && bp.line === line)) {
      globalBreakpoints.push({ file: normFile, line })
    }
    activeDebugger?.setBreakpoint(file, line)
  })
  ipcMain.on('debug:breakpoint:remove', (_, file: string, line: number) => {
    const normFile = file.replace(/\\/g, '/')
    globalBreakpoints = globalBreakpoints.filter(bp => !(bp.file === normFile && bp.line === line))
    activeDebugger?.removeBreakpoint(file, line)
  })
  ipcMain.on('debug:breakpoints:set-all', (_, bps: { file: string; line: number }[]) => {
    globalBreakpoints = bps.map(bp => ({ file: bp.file.replace(/\\/g, '/'), line: bp.line }))
    activeDebugger?.setAllBreakpoints(bps)
  })
  ipcMain.on('debug:continue', () => activeDebugger?.continue())
  ipcMain.on('debug:stepOver', () => activeDebugger?.stepOver())
  ipcMain.on('debug:stepIn', () => activeDebugger?.stepIn())
  ipcMain.on('debug:stepOut', () => activeDebugger?.stepOut())
}
