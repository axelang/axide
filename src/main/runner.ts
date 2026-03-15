import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { dirname, basename } from 'path'

let runProcess: ChildProcess | null = null

export function setupRunnerHandlers(mainWindow: BrowserWindow): void {
  ipcMain.on('run:start', (_, filePath: string, _mode: string) => {
    if (runProcess) { runProcess.kill(); runProcess = null }

    try {
      runProcess = spawn('axe', [basename(filePath), '-r', '-q'], {
        cwd: dirname(filePath),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      runProcess.stdout?.on('data', (d: Buffer) => mainWindow.webContents.send('run:output', d.toString()))
      runProcess.stderr?.on('data', (d: Buffer) => mainWindow.webContents.send('run:output', d.toString()))
      runProcess.on('exit', (code) => { mainWindow.webContents.send('run:exit', code ?? -1); runProcess = null })
      runProcess.on('error', (err) => {
        mainWindow.webContents.send('run:output', `Error: ${err.message}\n`)
        mainWindow.webContents.send('run:exit', -1)
        runProcess = null
      })
    } catch (err: any) {
      mainWindow.webContents.send('run:output', `Failed to start: ${err.message}\n`)
      mainWindow.webContents.send('run:exit', -1)
    }
  })

  ipcMain.on('run:stop', () => { if (runProcess) { runProcess.kill(); runProcess = null } })
}
