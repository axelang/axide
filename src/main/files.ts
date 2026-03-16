import { ipcMain, BrowserWindow, shell } from 'electron'
import { readdir, readFile, writeFile, mkdir, unlink, rename, rm, stat, access } from 'fs/promises'
import { join, relative } from 'path'
import { execSync } from 'child_process'

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

function getGitignoredFiles(rootPath: string): Set<string> {
  const ignored = new Set<string>()
  try {
    const output = execSync('git ls-files --others --ignored --exclude-standard --directory', {
      cwd: rootPath, encoding: 'utf-8', timeout: 5000
    })
    for (const line of output.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) {
        const normalized = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
        ignored.add(join(rootPath, normalized))
      }
    }
  } catch { /* git not available or not a git repo */ }
  return ignored
}

async function readDirectoryRecursive(
  dirPath: string,
  gitignored?: Set<string>
): Promise<FileEntry[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const result: FileEntry[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'out') continue
    const fullPath = join(dirPath, entry.name)
    if (gitignored && gitignored.has(fullPath)) continue
    const fe: FileEntry = { name: entry.name, path: fullPath, isDirectory: entry.isDirectory() }
    if (entry.isDirectory()) {
      fe.children = await readDirectoryRecursive(fullPath, gitignored)
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

async function isBinaryFile(filePath: string): Promise<boolean> {
  try {
    const fd = await readFile(filePath)
    const checkLength = Math.min(fd.length, 8192)
    for (let i = 0; i < checkLength; i++) {
      if (fd[i] === 0) return true
    }
    return false
  } catch { return false }
}

export function setupFileHandlers(_mainWindow: BrowserWindow): void {
  ipcMain.handle('files:readDirectory', async (_, dirPath: string, showGitignored: boolean = true) => {
    try {
      const gitignored = showGitignored ? undefined : getGitignoredFiles(dirPath)
      return await readDirectoryRecursive(dirPath, gitignored)
    }
    catch { return [] }
  })

  ipcMain.handle('files:isBinary', async (_, filePath: string) => {
    try { return await isBinaryFile(filePath) }
    catch { return false }
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
