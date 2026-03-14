import * as monaco from 'monaco-editor'

const pendingRequests: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }> = new Map()

let requestId = 0
let unsubMessage: (() => void) | null = null
let initialized = false
let workspaceRoot = ''

const documentVersions: Map<string, number> = new Map()

export function startLsp(workspace: string): void {
  workspaceRoot = workspace
  window.axide.lspStart(workspace)

  unsubMessage?.()
  unsubMessage = window.axide.onLspMessage(handleMessage)
  sendRequest('initialize', {
    processId: null,
    rootUri: `file:///${workspace.replace(/\\/g, '/')}`,
    capabilities: {
      textDocument: {
        synchronization: { didSave: true, dynamicRegistration: false },
        completion: { completionItem: { snippetSupport: false } },
        hover: { contentFormat: ['plaintext'] },
        definition: {},
        publishDiagnostics: {},
      }
    }
  }).then(() => {
    sendNotification('initialized', {})
    initialized = true
  }).catch(err => console.error('LSP init failed:', err))
}

export function stopLsp(): void {
  window.axide.lspStop()
  unsubMessage?.()
  unsubMessage = null
  initialized = false
  pendingRequests.clear()
  documentVersions.clear()
}

export function notifyDocumentOpened(filePath: string, content: string): void {
  if (!initialized) return
  documentVersions.set(filePath, 1)
  sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: filePathToUri(filePath),
      languageId: 'axe',
      version: 1,
      text: content
    }
  })
}

export function notifyDocumentChanged(filePath: string, content: string): void {
  if (!initialized) return
  const version = (documentVersions.get(filePath) || 0) + 1
  documentVersions.set(filePath, version)
  sendNotification('textDocument/didChange', {
    textDocument: { uri: filePathToUri(filePath), version },
    contentChanges: [{ text: content }]
  })
}

export function notifyDocumentClosed(filePath: string): void {
  if (!initialized) return
  documentVersions.delete(filePath)
  sendNotification('textDocument/didClose', {
    textDocument: { uri: filePathToUri(filePath) }
  })
}

export function registerProviders(): void {
  // Completion provider
  monaco.languages.registerCompletionItemProvider('axe', {
    triggerCharacters: ['.', ':'],
    provideCompletionItems: async (model, position) => {
      if (!initialized) return { suggestions: [] }
      try {
        const result = await sendRequest('textDocument/completion', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })
        const items = Array.isArray(result) ? result : result?.items || []
        return {
          suggestions: items.map((item: any) => ({
            label: item.label,
            kind: mapCompletionKind(item.kind),
            insertText: item.insertText || item.label,
            detail: item.detail,
            documentation: item.documentation,
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            }
          }))
        }
      } catch { return { suggestions: [] } }
    }
  })

  // Hover provider
  monaco.languages.registerHoverProvider('axe', {
    provideHover: async (model, position) => {
      if (!initialized) return null
      try {
        const result = await sendRequest('textDocument/hover', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })
        if (!result?.contents) return null
        let value = ''
        if (typeof result.contents === 'string') {
          value = result.contents
        } else if (Array.isArray(result.contents)) {
          value = result.contents.map((c: any) => typeof c === 'string' ? c : c.value).join('\n---\n')
        } else {
          value = result.contents.value || JSON.stringify(result.contents)
        }
        return {
          contents: [{ value }],
          range: result.range ? new monaco.Range(
            result.range.start.line + 1, result.range.start.character + 1,
            result.range.end.line + 1, result.range.end.character + 1
          ) : undefined
        }
      } catch { return null }
    }
  })

  // Definition provider
  monaco.languages.registerDefinitionProvider('axe', {
    provideDefinition: async (model, position) => {
      if (!initialized) return null
      try {
        const result = await sendRequest('textDocument/definition', {
          textDocument: { uri: model.uri.toString() },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })
        if (!result) return null
        const locs = Array.isArray(result) ? result : [result]
        return locs.map((loc: any) => ({
          uri: monaco.Uri.parse(loc.uri),
          range: new monaco.Range(
            loc.range.start.line + 1, loc.range.start.character + 1,
            loc.range.end.line + 1, loc.range.end.character + 1
          )
        }))
      } catch { return null }
    }
  })
}

// ── Internal helpers ──

function sendRequest(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    pendingRequests.set(id, { resolve, reject })
    window.axide.lspSend({ jsonrpc: '2.0', id, method, params })
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id)
        reject(new Error(`LSP request ${method} timed out`))
      }
    }, 10000)
  })
}

function sendNotification(method: string, params: any): void {
  window.axide.lspSend({ jsonrpc: '2.0', method, params })
}

function handleMessage(msg: any): void {
  // Response to a request
  if (msg.id !== undefined && pendingRequests.has(msg.id)) {
    const { resolve, reject } = pendingRequests.get(msg.id)!
    pendingRequests.delete(msg.id)
    if (msg.error) reject(new Error(msg.error.message))
    else resolve(msg.result)
    return
  }

  // Notification from server
  if (msg.method === 'textDocument/publishDiagnostics') {
    handleDiagnostics(msg.params)
  }
}

function handleDiagnostics(params: any): void {
  const uri = params.uri
  const model = monaco.editor.getModels().find(m => m.uri.toString() === uri)
  if (!model) return

  const markers: monaco.editor.IMarkerData[] = (params.diagnostics || []).map((d: any) => ({
    severity: mapSeverity(d.severity),
    message: d.message,
    startLineNumber: d.range.start.line + 1,
    startColumn: d.range.start.character + 1,
    endLineNumber: d.range.end.line + 1,
    endColumn: d.range.end.character + 1,
    source: 'axels'
  }))

  monaco.editor.setModelMarkers(model, 'axels', markers)
}

function mapSeverity(s: number): monaco.MarkerSeverity {
  switch (s) {
    case 1: return monaco.MarkerSeverity.Error
    case 2: return monaco.MarkerSeverity.Warning
    case 3: return monaco.MarkerSeverity.Info
    case 4: return monaco.MarkerSeverity.Hint
    default: return monaco.MarkerSeverity.Info
  }
}

function mapCompletionKind(k: number): monaco.languages.CompletionItemKind {
  const map: Record<number, monaco.languages.CompletionItemKind> = {
    1: monaco.languages.CompletionItemKind.Text,
    2: monaco.languages.CompletionItemKind.Method,
    3: monaco.languages.CompletionItemKind.Function,
    5: monaco.languages.CompletionItemKind.Field,
    6: monaco.languages.CompletionItemKind.Variable,
    7: monaco.languages.CompletionItemKind.Class,
    8: monaco.languages.CompletionItemKind.Interface,
    9: monaco.languages.CompletionItemKind.Module,
    14: monaco.languages.CompletionItemKind.Keyword,
    22: monaco.languages.CompletionItemKind.Struct,
  }
  return map[k] || monaco.languages.CompletionItemKind.Text
}

function filePathToUri(p: string): string {
  return monaco.Uri.file(p).toString()
}
