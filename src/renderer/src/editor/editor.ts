import * as monaco from 'monaco-editor'
import type { Settings } from '../env'

// Configure Monaco workers
self.MonacoEnvironment = {
  getWorker(_: any, _label: string) {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' }
    )
  }
}

export interface EditorTab {
  filePath: string
  fileName: string
  model: monaco.editor.ITextModel
  viewState: monaco.editor.ICodeEditorViewState | null
  modified: boolean
}

let editor: monaco.editor.IStandaloneCodeEditor | null = null
const tabs: Map<string, EditorTab> = new Map()
let activeTab: string | null = null
let currentTheme: 'dark' | 'light' = 'dark'
let formatOnSave = true

// Callbacks
let onTabChange: ((tabs: EditorTab[], active: string | null) => void) | null = null
let onCursorChange: ((line: number, col: number) => void) | null = null
let onFileModified: ((path: string, modified: boolean) => void) | null = null

export function initEditor(container: HTMLElement): monaco.editor.IStandaloneCodeEditor {
  editor = monaco.editor.create(container, {
    language: 'axe',
    theme: 'axide-dark',
    fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace",
    fontSize: 14,
    lineHeight: 22,
    tabSize: 4,
    insertSpaces: true,
    minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on',
    cursorBlinking: 'solid',
    renderLineHighlight: 'all',
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    padding: { top: 8 },
    cursorStyle: 'block',
    automaticLayout: true,
    wordWrap: 'off',
    suggest: { showKeywords: true, showSnippets: true },
    quickSuggestions: { other: true, comments: false, strings: false },
    parameterHints: { enabled: true },
    folding: true,
    foldingStrategy: 'indentation',
    glyphMargin: true,
  })

  editor.onDidChangeCursorPosition((e) => {
    onCursorChange?.(e.position.lineNumber, e.position.column)
  })

  // Ctrl+S save
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
    if (!activeTab) return
    const tab = tabs.get(activeTab)
    if (!tab) return

    let content = tab.model.getValue()

    if (formatOnSave) {
      try {
        const formatted = await window.axide.formatCode(content, tab.filePath)
        if (formatted && formatted !== content) {
          const pos = editor!.getPosition()
          tab.model.setValue(formatted)
          if (pos) editor!.setPosition(pos)
          content = formatted
        }
      } catch { /* format failed, save as-is */ }
    }

    await window.axide.writeFile(tab.filePath, content)
    tab.modified = false
    onFileModified?.(tab.filePath, false)
    notifyTabChange()
  })

  // Shift+Alt+F format
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, async () => {
    if (!activeTab) return
    const tab = tabs.get(activeTab)
    if (!tab) return
    try {
      const formatted = await window.axide.formatCode(tab.model.getValue(), tab.filePath)
      if (formatted) {
        const pos = editor!.getPosition()
        tab.model.setValue(formatted)
        if (pos) editor!.setPosition(pos)
      }
    } catch { /* ignore */ }
  })

  // Ctrl+P quick open
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
    window.dispatchEvent(new CustomEvent('quick-open-request'))
  })

  return editor
}

export function openFile(filePath: string, content: string, fileName: string): void {
  if (!editor) return

  let tab = tabs.get(filePath)
  if (tab) {
    switchToTab(filePath)
    return
  }

  const language = filePath.endsWith('.axe') ? 'axe' : 'plaintext'
  const model = monaco.editor.createModel(content, language, monaco.Uri.file(filePath))

  model.onDidChangeContent(() => {
    const t = tabs.get(filePath)
    if (t && !t.modified) {
      t.modified = true
      onFileModified?.(filePath, true)
      notifyTabChange()
    }
  })

  tab = { filePath, fileName, model, viewState: null, modified: false }
  tabs.set(filePath, tab)
  switchToTab(filePath)
}

export function switchToTab(filePath: string): void {
  if (!editor) return

  // Save current view state
  if (activeTab) {
    const prev = tabs.get(activeTab)
    if (prev) prev.viewState = editor.saveViewState()
  }

  const tab = tabs.get(filePath)
  if (!tab) return

  editor.setModel(tab.model)
  if (tab.viewState) editor.restoreViewState(tab.viewState)
  editor.focus()
  activeTab = filePath
  currentBreakpointDecoIds = [] // Reset deco tracking for new tab
  applyBreakpointDecorations()
  notifyTabChange()

  const monacoEl = document.getElementById('monaco-container')
  const welcomeEl = document.getElementById('welcome-screen')

  if (monacoEl && welcomeEl && !welcomeEl.classList.contains('hidden')) {
    welcomeEl.classList.add('hidden')
    monacoEl.classList.add('visible')
    monacoEl.classList.remove('slide-in')
    void monacoEl.offsetWidth
    monacoEl.classList.add('slide-in')
  } else if (monacoEl) {
    monacoEl.classList.add('visible')
  }
  if (welcomeEl) welcomeEl.classList.add('hidden')
}

export function closeTab(filePath: string): void {
  const tab = tabs.get(filePath)
  if (!tab) return

  tab.model.dispose()
  tabs.delete(filePath)

  if (activeTab === filePath) {
    const remaining = Array.from(tabs.keys())
    if (remaining.length > 0) {
      switchToTab(remaining[remaining.length - 1])
    } else {
      activeTab = null
      editor?.setModel(null)
    }
  }
 
  if (tabs.size === 0) {
    activeTab = null
    editor?.setModel(null)
    // Show welcome, hide monaco
    const monacoEl = document.getElementById('monaco-container')
    const welcomeEl = document.getElementById('welcome-screen')
    if (monacoEl) monacoEl.classList.remove('visible')
    if (welcomeEl) welcomeEl.classList.remove('hidden')
  }
  notifyTabChange()
}

export function getActiveFilePath(): string | null { return activeTab }
export function getActiveContent(): string | null {
  if (!activeTab) return null
  return tabs.get(activeTab)?.model.getValue() || null
}
export function getTabs(): EditorTab[] { return Array.from(tabs.values()) }
export function getEditor(): monaco.editor.IStandaloneCodeEditor | null { return editor }

export function applySettings(settings: Settings): void {
  if (!editor) return
  currentTheme = settings.theme
  formatOnSave = settings.formatOnSave
  monaco.editor.setTheme(settings.theme === 'dark' ? 'axide-dark' : 'axide-light')
  editor.updateOptions({
    fontSize: settings.fontSize,
    tabSize: settings.tabSize,
  })
  // Apply theme to document
  document.documentElement.setAttribute('data-theme', settings.theme)
}

export function onTabsChanged(cb: (tabs: EditorTab[], active: string | null) => void): void {
  onTabChange = cb
}

export function onCursorChanged(cb: (line: number, col: number) => void): void {
  onCursorChange = cb
}

export function onFileModifiedChanged(cb: (path: string, modified: boolean) => void): void {
  onFileModified = cb
}

function notifyTabChange(): void {
  onTabChange?.(Array.from(tabs.values()), activeTab)
}

// Breakpoint support — track line numbers per file for persistence
const fileBreakpoints: Map<string, Set<number>> = new Map()
let currentBreakpointDecoIds: string[] = []

function applyBreakpointDecorations(): void {
  if (!editor || !activeTab) return
  const lines = fileBreakpoints.get(activeTab)
  if (!lines || lines.size === 0) {
    currentBreakpointDecoIds = editor.deltaDecorations(currentBreakpointDecoIds, [])
    return
  }
  const decos = Array.from(lines).map(lineNumber => ({
    range: new monaco.Range(lineNumber, 1, lineNumber, 1),
    options: {
      glyphMarginClassName: 'breakpoint-glyph',
      isWholeLine: true,
      className: 'breakpoint-line',
      stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
    }
  }))
  currentBreakpointDecoIds = editor.deltaDecorations(currentBreakpointDecoIds, decos)
}

export function toggleBreakpoint(lineNumber: number): { file: string; line: number; added: boolean } | null {
  if (!editor || !activeTab) return null

  let lines = fileBreakpoints.get(activeTab)
  if (!lines) {
    lines = new Set()
    fileBreakpoints.set(activeTab, lines)
  }

  const added = !lines.has(lineNumber)
  if (added) {
    lines.add(lineNumber)
  } else {
    lines.delete(lineNumber)
  }
  applyBreakpointDecorations()
  return { file: activeTab, line: lineNumber, added }
}

export function removeBreakpointAt(file: string, line: number): void {
  const lines = fileBreakpoints.get(file)
  if (!lines) return
  lines.delete(line)
  if (file === activeTab) applyBreakpointDecorations()
}

export interface Breakpoint { file: string; line: number }

export function getBreakpoints(): Breakpoint[] {
  const result: Breakpoint[] = []
  for (const [file, lines] of fileBreakpoints) {
    for (const line of lines) {
      result.push({ file, line })
    }
  }
  return result
}

export function clearBreakpoints(): void {
  for (const lines of fileBreakpoints.values()) {
    lines.clear()
  }
  applyBreakpointDecorations()
}
