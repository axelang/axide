import { ipcMain, BrowserWindow, shell } from 'electron'
import { readdir, readFile, writeFile, mkdir, unlink, rename, rm } from 'fs/promises'
import { join } from 'path'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

async function readDirectoryRecursive(dirPath: string): Promise<FileEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const result: FileEntry[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'out') continue
    const fullPath = join(dirPath, entry.name)
    const fe: FileEntry = { name: entry.name, path: fullPath, isDirectory: entry.isDirectory() }
    if (entry.isDirectory()) {
      fe.children = await readDirectoryRecursive(fullPath)
    }
    result.push(fe)
  }

  result.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
  return result
}

export function setupFileHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle('files:readDirectory', async (_, dirPath: string) => {
    try { return await readDirectoryRecursive(dirPath) }
    catch { return [] }
  })

  ipcMain.handle('files:readFile', async (_, filePath: string) => {
    try { return await readFile(filePath, 'utf-8') }
    catch { return null }
  })

  ipcMain.handle('files:writeFile', async (_, filePath: string, content: string) => {
    try { await writeFile(filePath, content, 'utf-8'); return true }
    catch { return false }
  })

  ipcMain.handle('files:createFile', async (_, filePath: string, content?: string) => {
    try {
      await mkdir(join(filePath, '..'), { recursive: true })
      await writeFile(filePath, content || '', 'utf-8')
      return true
    } catch { return false }
  })

  ipcMain.handle('files:createDirectory', async (_, dirPath: string) => {
    try {
      await mkdir(dirPath, { recursive: true })
      return true
    } catch { return false }
  })

  ipcMain.handle('files:deleteFile', async (_, filePath: string) => {
    try {
      await rm(filePath, { recursive: true, force: true })
      return true
    } catch { return false }
  })

  ipcMain.handle('files:rename', async (_, oldPath: string, newPath: string) => {
    try {
      await rename(oldPath, newPath)
      return true
    } catch { return false }
  })

  ipcMain.handle('files:move', async (_, srcPath: string, destDir: string) => {
    try {
      const fileName = srcPath.split(/[/\\]/).pop()
      if (!fileName) return false
      await rename(srcPath, join(destDir, fileName))
      return true
    } catch { return false }
  })

  ipcMain.handle('files:showItemInFolder', async (_, filePath: string) => {
    shell.showItemInFolder(filePath)
    return true
  })
}
