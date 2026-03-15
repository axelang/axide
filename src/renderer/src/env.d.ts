export interface AxideAPI {
  openFolder(): Promise<string | null>
  readDirectory(path: string): Promise<FileEntry[]>
  readFile(path: string): Promise<string | null>
  writeFile(path: string, content: string): Promise<boolean>
  createFile(path: string, content?: string): Promise<boolean>
  createDirectory(path: string): Promise<boolean>
  deleteFile(path: string): Promise<boolean>
  renameFile(oldPath: string, newPath: string): Promise<boolean>
  moveFile(srcPath: string, destDir: string): Promise<boolean>
  showItemInFolder(path: string): Promise<boolean>

  formatCode(code: string, filePath: string): Promise<string>

  lspStart(workspace: string): void
  lspStop(): void
  lspSend(msg: any): void
  onLspMessage(cb: (msg: any) => void): () => void

  runStart(file: string, mode: string): void
  runStop(): void
  onRunOutput(cb: (data: string) => void): () => void
  onRunExit(cb: (code: number) => void): () => void

  debugStart(file: string): void
  debugStop(): void
  debugSetBreakpoint(file: string, line: number): void
  debugRemoveBreakpoint(file: string, line: number): void
  debugSetAllBreakpoints(bps: { file: string; line: number }[]): void
  debugContinue(): void
  debugStepOver(): void
  debugStepIn(): void
  debugStepOut(): void
  onDebugStopped(cb: (data: DebugStopEvent) => void): () => void
  onDebugOutput(cb: (data: string) => void): () => void
  onDebugVariables(cb: (vars: DebugVariable[]) => void): () => void
  onDebugExited(cb: () => void): () => void

  getSettings(): Promise<Settings>
  setSettings(settings: Settings): Promise<boolean>

  windowMinimize(): void
  windowMaximize(): void
  windowClose(): void
  onMenuCloseTab(cb: () => void): () => void

  terminalInit(): void
  terminalWrite(data: string): void
  terminalResize(cols: number, rows: number): void
  onTerminalData(cb: (data: string) => void): () => void
  onTerminalExit(cb: (code: number) => void): () => void
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  children?: FileEntry[]
}

export interface Settings {
  formatOnSave: boolean
  theme: 'dark' | 'light'
  fontSize: number
  tabSize: number
  axePath: string
  axelsPath: string
  axefmtPath: string
  gdbPath: string
  lastOpenedFolder: string
  lastOpenedFile: string
}

export interface DebugStopEvent {
  reason: string
  file: string
  line: number
}

export interface DebugVariable {
  name: string
  type: string
  value: string
}

declare global {
  interface Window {
    axide: AxideAPI
  }
}
