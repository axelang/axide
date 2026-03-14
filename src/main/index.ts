import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { setupFileHandlers } from './files'
import { setupFormatHandlers } from './format'
import { setupLspHandlers } from './lsp'
import { setupRunnerHandlers } from './runner'
import { setupDebugHandlers } from './debugger'
import { setupSettingsHandlers } from './settings'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1b26',
    paintWhenInitiallyHidden: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f0f',
      symbolColor: '#eee5e5ff',
      height: 38
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  setupFileHandlers(mainWindow)
  setupFormatHandlers()
  setupLspHandlers(mainWindow)
  setupRunnerHandlers(mainWindow)
  setupDebugHandlers(mainWindow)
  setupSettingsHandlers()

  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  setTimeout(() => {
    mainWindow?.show();
  }, 1000);

  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
