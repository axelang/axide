import { ipcMain } from 'electron'
import { spawn } from 'child_process'

export function setupFormatHandlers(): void {
  ipcMain.handle('format:code', async (_, code: string, _filePath: string) => {
    return new Promise<string>((resolve) => {
      try {
        const proc = spawn('axefmt', [], { stdio: ['pipe', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''

        proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
        proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
        proc.on('close', (exitCode) => {
          if (exitCode === 0 && stdout.length > 0) resolve(stdout)
          else { console.error('axefmt error:', stderr); resolve(code) }
        })
        proc.on('error', () => resolve(code))

        proc.stdin.write(code)
        proc.stdin.end()
      } catch { resolve(code) }
    })
  })
}
