import { ipcMain, BrowserWindow } from 'electron'
import * as pty from 'node-pty'

let ptyProcess: pty.IPty | null = null

export function setupTerminalHandlers(mainWindow: BrowserWindow): void {
  let shell = ''
  if (process.platform === 'win32') {
    shell = 'powershell.exe'
  } else if (process.platform === 'darwin') {
    shell = 'zsh'
  } else {
    shell = process.env.SHELL || 'bash'
  }

  ipcMain.on('terminal:init', () => {
    if (ptyProcess) return

    try {
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
    } catch (err) {
      console.error('Failed to spawn terminal:', err)
      // Fallback for Windows if powershell.exe fails for some reason
      if (process.platform === 'win32' && shell !== 'cmd.exe') {
        shell = 'cmd.exe'
        // We don't recurse here to avoid infinite loops, but next init will use cmd
      }
    }
  })

  ipcMain.on('terminal:write', (_, data: string) => {
    ptyProcess?.write(data)
  })

  ipcMain.on('terminal:resize', (_, cols: number, rows: number) => {
    ptyProcess?.resize(cols, rows)
  })
}
