import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('axide', {
  // File system
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readDirectory: (p: string) => ipcRenderer.invoke('files:readDirectory', p),
  readFile: (p: string) => ipcRenderer.invoke('files:readFile', p),
  writeFile: (p: string, c: string) => ipcRenderer.invoke('files:writeFile', p, c),
  createFile: (p: string, c?: string) => ipcRenderer.invoke('files:createFile', p, c),
  deleteFile: (p: string) => ipcRenderer.invoke('files:deleteFile', p),

  // Format
  formatCode: (code: string, filePath: string) => ipcRenderer.invoke('format:code', code, filePath),

  // LSP
  lspStart: (workspace: string) => ipcRenderer.send('lsp:start', workspace),
  lspStop: () => ipcRenderer.send('lsp:stop'),
  lspSend: (msg: any) => ipcRenderer.send('lsp:send', msg),
  onLspMessage: (cb: (msg: any) => void) => {
    const h = (_: any, msg: any) => cb(msg)
    ipcRenderer.on('lsp:message', h)
    return () => { ipcRenderer.removeListener('lsp:message', h) }
  },

  // Run
  runStart: (file: string, mode: string) => ipcRenderer.send('run:start', file, mode),
  runStop: () => ipcRenderer.send('run:stop'),
  onRunOutput: (cb: (d: string) => void) => {
    const h = (_: any, d: string) => cb(d)
    ipcRenderer.on('run:output', h)
    return () => { ipcRenderer.removeListener('run:output', h) }
  },
  onRunExit: (cb: (code: number) => void) => {
    const h = (_: any, code: number) => cb(code)
    ipcRenderer.on('run:exit', h)
    return () => { ipcRenderer.removeListener('run:exit', h) }
  },

  // Debug
  debugStart: (file: string) => ipcRenderer.send('debug:start', file),
  debugStop: () => ipcRenderer.send('debug:stop'),
  debugSetBreakpoint: (f: string, l: number) => ipcRenderer.send('debug:breakpoint:set', f, l),
  debugRemoveBreakpoint: (f: string, l: number) => ipcRenderer.send('debug:breakpoint:remove', f, l),
  debugContinue: () => ipcRenderer.send('debug:continue'),
  debugStepOver: () => ipcRenderer.send('debug:stepOver'),
  debugStepIn: () => ipcRenderer.send('debug:stepIn'),
  debugStepOut: () => ipcRenderer.send('debug:stepOut'),
  onDebugStopped: (cb: (d: any) => void) => {
    const h = (_: any, d: any) => cb(d)
    ipcRenderer.on('debug:stopped', h)
    return () => { ipcRenderer.removeListener('debug:stopped', h) }
  },
  onDebugOutput: (cb: (d: string) => void) => {
    const h = (_: any, d: string) => cb(d)
    ipcRenderer.on('debug:output', h)
    return () => { ipcRenderer.removeListener('debug:output', h) }
  },
  onDebugVariables: (cb: (v: any[]) => void) => {
    const h = (_: any, v: any[]) => cb(v)
    ipcRenderer.on('debug:variables', h)
    return () => { ipcRenderer.removeListener('debug:variables', h) }
  },
  onDebugExited: (cb: () => void) => {
    const h = () => cb()
    ipcRenderer.on('debug:exited', h)
    return () => { ipcRenderer.removeListener('debug:exited', h) }
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s: any) => ipcRenderer.invoke('settings:set', s),

  // Window
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close')
})
