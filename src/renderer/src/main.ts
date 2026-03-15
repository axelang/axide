import './styles/index.css'
import { registerAxeLanguage } from './languages/axe-language'
import {
  initEditor, openFile, switchToTab, closeTab, getActiveFilePath,
  onTabsChanged, onCursorChanged, applySettings,
  toggleBreakpoint, getEditor, getBreakpoints, type EditorTab
} from './editor/editor'
import { startLsp, notifyDocumentOpened, notifyDocumentChanged, notifyDocumentClosed, registerProviders } from './editor/lsp-client'
import { initFileExplorer, loadDirectory, setActiveFile, refreshTree, getRootPath } from './panels/file-explorer'
import { initTerminal, runFile, stopRun } from './panels/terminal'
import { initInteractiveTerminal, focusTerminal } from './panels/interactive-terminal'
import { initSearch } from './panels/search'
import { initDebugPanel, startDebug, updateBreakpointsUI } from './panels/debugger'
import { initSettings, getSettings } from './panels/settings'
import { initQuickOpen, showQuickOpen } from './panels/quick-open'
import { initSymbolPicker, showSymbolPicker } from './panels/symbol-picker'
import type { Settings } from './env'

async function init(): Promise<void> {
  registerAxeLanguage()
  const monacoContainer = document.getElementById('monaco-container')!
  initEditor(monacoContainer)
  registerProviders()
  initFileExplorer(document.getElementById('file-tree')!, handleFileOpen)
  initTerminal()
  initInteractiveTerminal()
  initSearch(document.getElementById('search-panel')!, handleGoToFile)
  initDebugPanel(document.getElementById('debug-panel')!, handleDebugNavigate)
  await initSettings(document.getElementById('settings-panel')!, handleSettingsChanged)
  initQuickOpen(handleFileOpen)
  initSymbolPicker(handleSymbolSelect)
  const settings = getSettings()
  applySettings(settings)
  if (settings.lastOpenedFolder) {
    await openFolder(settings.lastOpenedFolder)
    if (settings.lastOpenedFile) {
      await handleFileOpen(settings.lastOpenedFile)
    }
  }
  onTabsChanged(renderTabs)
  onCursorChanged((line, col) => {
    const el = document.getElementById('status-cursor')
    if (el) el.textContent = `Ln ${line}, Col ${col}`
  })
  setupActivityBar()

  setupPanelTabs()

  setupResizeHandles()

  setupButtons()

  setupKeyboardShortcuts()

  document.addEventListener('debug-start-request', () => {
    const fp = getActiveFilePath()
    if (fp) {
      window.axide.debugSetAllBreakpoints(getBreakpoints())
      startDebug(fp)
    }
  })

  window.addEventListener('quick-open-request', () => {
    showQuickOpen()
  })
 
  window.axide.onMenuCloseTab(() => {
    const fp = getActiveFilePath()
    if (fp) {
      closeTab(fp)
      notifyDocumentClosed(fp)
    }
  })

  const editor = getEditor()
  if (editor) {
    editor.onMouseDown((e) => {
      if (e.target.type === 2 /* GUTTER_GLYPH_MARGIN */) {
        const line = e.target.position?.lineNumber
        if (line) {
          const result = toggleBreakpoint(line)
          if (result) {
            if (result.added) {
              window.axide.debugSetBreakpoint(result.file, result.line)
            } else {
              window.axide.debugRemoveBreakpoint(result.file, result.line)
            }
            updateBreakpointsUI()
          }
        }
      }
    })

    editor.onDidChangeModelContent(() => {
      const fp = getActiveFilePath()
      if (fp) {
        const model = editor.getModel()
        if (model) notifyDocumentChanged(fp, model.getValue())
      }
    })
  }
}

async function handleFileOpen(filePath: string): Promise<void> {
  const content = await window.axide.readFile(filePath)
  if (content === null) return
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  openFile(filePath, content, fileName)
  setActiveFile(filePath)
  notifyDocumentOpened(filePath, content)
}

async function handleGoToFile(file: string, line: number, col: number): Promise<void> {
  await handleFileOpen(file)
  const editor = getEditor()
  if (editor) {
    editor.setPosition({ lineNumber: line, column: col })
    editor.revealLineInCenter(line)
    editor.focus()
  }
}

function handleDebugNavigate(file: string, line: number): void {
  handleGoToFile(file, line, 1)
}

function handleSymbolSelect(line: number, col: number): void {
  const editor = getEditor()
  if (editor) {
    editor.setPosition({ lineNumber: line, column: col })
    editor.revealLineInCenter(line)
    editor.focus()
  }
}

function handleSettingsChanged(settings: Settings): void {
  applySettings(settings)
}

async function openFolder(folderPath: string): Promise<void> {
  await loadDirectory(folderPath)
  startLsp(folderPath)

  const settings = getSettings()
  settings.lastOpenedFolder = folderPath
  window.axide.setSettings(settings)
}

function renderTabs(tabs: EditorTab[], active: string | null): void {
  const tabBar = document.getElementById('tab-bar')!
  tabBar.innerHTML = ''

  for (const tab of tabs) {
    const el = document.createElement('div')
    el.className = `tab ${tab.filePath === active ? 'active' : ''} ${tab.modified ? 'modified' : ''}`
    el.innerHTML = `
      <span class="tab-name">${escapeHtml(tab.fileName)}</span>
      <span class="tab-close">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </span>
    `

    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.tab-close')) {
        closeTab(tab.filePath)
        notifyDocumentClosed(tab.filePath)
      } else {
        switchToTab(tab.filePath)
        setActiveFile(tab.filePath)
      }

      const newActive = getActiveFilePath()
      const currentSettings = getSettings()
      if (currentSettings.lastOpenedFile !== (newActive || '')) {
        currentSettings.lastOpenedFile = newActive || ''
        window.axide.setSettings(currentSettings)
      }
    })

    el.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.preventDefault()
        closeTab(tab.filePath)
        notifyDocumentClosed(tab.filePath)
      }
    })

    tabBar.appendChild(el)
  }
}

function setupActivityBar(): void {
  const buttons = document.querySelectorAll('.activity-btn[data-panel]')
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.getAttribute('data-panel')!
      const sidebar = document.getElementById('sidebar')!

      if (btn.classList.contains('active')) {
        sidebar.classList.toggle('sidebar-visible')
        return
      }

      buttons.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'))
      document.getElementById(`sidebar-${panel}`)?.classList.add('active')

      sidebar.classList.add('sidebar-visible')
    })
  })
}

function setupPanelTabs(): void {
  document.querySelectorAll('.panel-tab[data-target]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'))
      document.querySelectorAll('.panel-body').forEach(p => p.classList.remove('active'))
      tab.classList.add('active')
      const target = tab.getAttribute('data-target')!
      document.getElementById(target)?.classList.add('active')
    })
  })

  document.getElementById('btn-toggle-panel')?.addEventListener('click', () => {
    document.getElementById('bottom-panel')?.classList.toggle('panel-collapsed')
  })
}

function setupResizeHandles(): void {
  const sidebarHandle = document.getElementById('resize-handle-sidebar')!
  const sidebar = document.getElementById('sidebar')!
  let dragging = false
  let startX = 0
  let startWidth = 0

  sidebarHandle.addEventListener('mousedown', (e) => {
    dragging = true
    startX = e.clientX
    startWidth = sidebar.offsetWidth
    sidebarHandle.classList.add('dragging')
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  })

  const panelHandle = document.getElementById('resize-handle-panel')!
  const bottomPanel = document.getElementById('bottom-panel')!
  let panelDragging = false
  let panelStartY = 0
  let panelStartHeight = 0

  panelHandle.addEventListener('mousedown', (e) => {
    panelDragging = true
    panelStartY = e.clientY
    panelStartHeight = bottomPanel.offsetHeight
    panelHandle.classList.add('dragging')
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  })

  document.addEventListener('mousemove', (e) => {
    if (dragging) {
      const delta = e.clientX - startX
      const newWidth = Math.max(150, Math.min(500, startWidth + delta))
      sidebar.style.width = `${newWidth}px`
    }
    if (panelDragging) {
      const delta = panelStartY - e.clientY
      const newHeight = Math.max(100, Math.min(500, panelStartHeight + delta))
      bottomPanel.style.height = `${newHeight}px`
      bottomPanel.classList.remove('panel-collapsed')
    }
  })

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false
      sidebarHandle.classList.remove('dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    if (panelDragging) {
      panelDragging = false
      panelHandle.classList.remove('dragging')
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  })
}

function setupButtons(): void {
  const openFolderHandler = async () => {
    const folder = await window.axide.openFolder()
    if (folder) await openFolder(folder)
  }

  document.getElementById('btn-open-folder')?.addEventListener('click', openFolderHandler)
  document.getElementById('welcome-open-folder')?.addEventListener('click', openFolderHandler)

  const newFileHandler = () => showNewFileModal()
  document.getElementById('btn-new-file')?.addEventListener('click', newFileHandler)
  document.getElementById('welcome-new-file')?.addEventListener('click', newFileHandler)

  document.getElementById('btn-run')?.addEventListener('click', () => {
    const fp = getActiveFilePath()
    if (fp) runFile(fp, 'main')
  })
  document.getElementById('btn-run-test')?.addEventListener('click', () => {
    const fp = getActiveFilePath()
    if (fp) runFile(fp, 'test')
  })
  document.getElementById('btn-stop')?.addEventListener('click', () => stopRun())
}

function showNewFileModal(): void {
  const overlay = document.getElementById('modal-overlay')!
  const modal = document.getElementById('new-file-modal')!
  const input = document.getElementById('new-file-name') as HTMLInputElement
  overlay.classList.remove('hidden')
  modal.classList.remove('hidden')
  input.value = ''
  input.focus()

  const create = async () => {
    const name = input.value.trim()
    if (!name) return
    const root = getRootPath()
    if (!root) return
    const sep = root.includes('/') ? '/' : '\\'
    let filePath = root + sep + name
    if (!filePath.endsWith('.axe')) filePath += '.axe'

    const moduleName = name.replace(/\.axe$/, '').replace(/[\\/]/g, '.')
    const template = `/// ${moduleName} module\n\ndef main {\n    println("Hello from ${moduleName}!");\n}\n`

    await window.axide.createFile(filePath, template)
    await refreshTree()
    await handleFileOpen(filePath)
    closeModal()
  }

  document.getElementById('modal-create')!.onclick = create
  document.getElementById('modal-cancel')!.onclick = closeModal
  input.onkeydown = (e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') closeModal() }
  overlay.onclick = (e) => { if (e.target === overlay) closeModal() }
}

function closeModal(): void {
  document.getElementById('modal-overlay')!.classList.add('hidden')
  document.getElementById('new-file-modal')!.classList.add('hidden')
}


function setupKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // F5: Run
    if (e.key === 'F5' && !e.ctrlKey && !e.shiftKey) {
      e.preventDefault()
      const fp = getActiveFilePath()
      if (fp) runFile(fp, 'main')
    }
    // F9: Debug
    if (e.key === 'F9') {
      e.preventDefault()
      const fp = getActiveFilePath()
      if (fp) {
        window.axide.debugSetAllBreakpoints(getBreakpoints())
        startDebug(fp)
      }
    }
    // Ctrl+Shift+E: Explorer
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault()
      switchActivityPanel('explorer')
    }
    // Ctrl+Shift+F: Search
    if (e.ctrlKey && e.shiftKey && e.key === 'F') {
      e.preventDefault()
      switchActivityPanel('search')
    }
    // Ctrl+Shift+D: Debug
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault()
      switchActivityPanel('debug')
    }
    // Ctrl+,: Settings
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault()
      switchActivityPanel('settings')
    }
    // Ctrl+`: Toggle panel
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault()
      document.getElementById('bottom-panel')?.classList.toggle('panel-collapsed')
    }
    // Ctrl+J: Terminal
    if (e.ctrlKey && e.key === 'j') {
      e.preventDefault()
      const panel = document.getElementById('bottom-panel')
      if (panel?.classList.contains('panel-collapsed')) {
        panel.classList.remove('panel-collapsed')
        switchToTerminalTab()
      } else {
        const activeTab = document.querySelector('.panel-tab.active')
        if (activeTab?.getAttribute('data-target') === 'terminal-content') {
          panel?.classList.add('panel-collapsed')
        } else {
          switchToTerminalTab()
        }
      }
    }
    // Ctrl+P: Quick Open
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault()
      showQuickOpen()
    }
    // Ctrl+Shift+O: Symbol Picker
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'o') {
      e.preventDefault()
      showSymbolPicker()
    }
    // Ctrl+;: Focus Editor
    if (e.ctrlKey && e.key === ';') {
      e.preventDefault()
      const editor = getEditor()
      if (editor) {
        editor.focus()
      }
    }
    // Ctrl+B: Toggle sidebar
    if (e.ctrlKey && e.key === 'b') {
      e.preventDefault()
      document.getElementById('sidebar')?.classList.toggle('sidebar-visible')
    }
    // Ctrl+W: Close tab
    const isCmdOrCtrl = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? e.metaKey : e.ctrlKey
    if (isCmdOrCtrl && e.key.toLowerCase() === 'w') {
      e.preventDefault()
      const fp = getActiveFilePath()
      if (fp) {
        closeTab(fp)
        notifyDocumentClosed(fp)
      }
    }
  })
}

function switchToTerminalTab(): void {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.panel-body').forEach(p => p.classList.remove('active'))
  const tab = document.querySelector('[data-target="terminal-content"]')
  tab?.classList.add('active')
  document.getElementById('terminal-content')?.classList.add('active')
  focusTerminal()
}

function switchActivityPanel(panel: string): void {
  document.querySelectorAll('.activity-btn[data-panel]').forEach(b => b.classList.remove('active'))
  document.querySelector(`.activity-btn[data-panel="${panel}"]`)?.classList.add('active')
  document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'))
  document.getElementById(`sidebar-${panel}`)?.classList.add('active')
  document.getElementById('sidebar')?.classList.add('sidebar-visible')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

init().catch(console.error)
