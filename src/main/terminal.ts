import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'
import * as os from 'os'

let ptyProcess: pty.IPty | null = null

export function setupTerminalHandlers(mainWindow: BrowserWindow): void {
  const shell = process.platform === 'win32' 
    ? (process.env.COMSPEC || 'powershell.exe') 
    : (process.env.SHELL || 'bash')

  ipcMain.on('terminal:init', () => {
    if (ptyProcess) return

    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env as any
    })

    ptyProcess.onData((data) => {
      mainWindow.webContents.send('terminal:data', data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      mainWindow.webContents.send('terminal:exit', exitCode)
      ptyProcess = null
    })
  })

  ipcMain.on('terminal:write', (_, data: string) => {
    ptyProcess?.write(data)
  })

  ipcMain.on('terminal:resize', (_, cols: number, rows: number) => {
    ptyProcess?.resize(cols, rows)
  })
}
