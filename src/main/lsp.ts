import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'

let lspProcess: ChildProcess | null = null
let messageBuffer = ''

function parseLspMessages(data: string, cb: (msg: any) => void): void {
  messageBuffer += data
  while (true) {
    const headerEnd = messageBuffer.indexOf('\r\n\r\n')
    if (headerEnd === -1) break
    const header = messageBuffer.substring(0, headerEnd)
    const match = header.match(/Content-Length:\s*(\d+)/i)
    if (!match) { messageBuffer = messageBuffer.substring(headerEnd + 4); continue }
    const len = parseInt(match[1])
    const start = headerEnd + 4
    if (messageBuffer.length < start + len) break
    const body = messageBuffer.substring(start, start + len)
    messageBuffer = messageBuffer.substring(start + len)
    try { cb(JSON.parse(body)) } catch (e) { console.error('LSP parse error:', e) }
  }
}

export function setupLspHandlers(mainWindow: BrowserWindow): void {
  ipcMain.on('lsp:start', (_, workspacePath: string) => {
    if (lspProcess) lspProcess.kill()
    messageBuffer = ''
    try {
      lspProcess = spawn('axels', [], { cwd: workspacePath, stdio: ['pipe', 'pipe', 'pipe'] })
      lspProcess.stdout?.on('data', (d: Buffer) => {
        parseLspMessages(d.toString(), (msg) => mainWindow.webContents.send('lsp:message', msg))
      })
      lspProcess.stderr?.on('data', (d: Buffer) => console.error('LSP stderr:', d.toString()))
      lspProcess.on('exit', () => { lspProcess = null })
      lspProcess.on('error', (err) => { console.error('LSP error:', err); lspProcess = null })
    } catch (err) { console.error('Failed to start LSP:', err) }
  })

  ipcMain.on('lsp:stop', () => { if (lspProcess) { lspProcess.kill(); lspProcess = null } })

  ipcMain.on('lsp:send', (_, message: any) => {
    if (!lspProcess?.stdin) return
    const content = JSON.stringify(message)
    const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`
    try { lspProcess.stdin.write(header + content) } catch (e) { console.error('LSP write error:', e) }
  })
}
