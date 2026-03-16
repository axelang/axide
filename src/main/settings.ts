import { ipcMain } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

export interface Settings {
  formatOnSave: boolean
  theme: 'dark' | 'light'
  fontSize: number
  tabSize: number
  axePath: string
  axelsPath: string
  axefmtPath: string
  debuggerPath: string
  lastOpenedFolder: string
  lastOpenedFile: string
}

const DEFAULT_SETTINGS: Settings = {
  formatOnSave: true,
  theme: 'dark',
  fontSize: 14,
  tabSize: 4,
  axePath: 'axe',
  axelsPath: 'axels',
  axefmtPath: 'axefmt',
  debuggerPath: process.platform === 'darwin' ? 'lldb-dap' : 'gdb',
  lastOpenedFolder: '',
  lastOpenedFile: ''
}

const settingsDir = join(homedir(), '.axide')
const settingsFile = join(settingsDir, 'settings.json')

export async function loadSettings(): Promise<Settings> {
  try {
    const data = await readFile(settingsFile, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(settings: Settings): Promise<void> {
  await mkdir(settingsDir, { recursive: true })
  await writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf-8')
}

export function setupSettingsHandlers(): void {
  ipcMain.handle('settings:get', async () => loadSettings())
  ipcMain.handle('settings:set', async (_, settings: Settings) => {
    try { await saveSettings(settings); return true }
    catch { return false }
  })
}
