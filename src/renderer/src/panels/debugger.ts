import { appendDebugOutput, clearDebugConsole } from './terminal'
import { getBreakpoints, removeBreakpointAt } from '../editor/editor'
import type { DebugVariable } from '../env'

let isDebugging = false
let variablesContainer: HTMLElement | null = null
let unsubStopped: (() => void) | null = null
let unsubOutput: (() => void) | null = null
let unsubVars: (() => void) | null = null
let unsubExited: (() => void) | null = null
let onDebugNavigate: ((file: string, line: number) => void) | null = null

export function initDebugPanel(container: HTMLElement, navigateCb: (file: string, line: number) => void): void {
  onDebugNavigate = navigateCb

  container.innerHTML = `
    <div class="debug-toolbar">
      <button class="debug-btn" id="dbg-start" title="Start Debug (F9)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
      <button class="debug-btn" id="dbg-continue" title="Continue (F5)" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
      </button>
      <button class="debug-btn" id="dbg-step-over" title="Step Over (F10)" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M4 12h4m4 0h8M14 8l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <button class="debug-btn" id="dbg-step-in" title="Step In (F11)" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 4v12m0 0l-4-4m4 4l4-4M12 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <button class="debug-btn" id="dbg-step-out" title="Step Out (Shift+F11)" disabled>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 20V8m0 0l-4 4m4-4l4 4M12 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
      <button class="debug-btn" id="dbg-stop" title="Stop" disabled style="color: var(--red)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
      </button>
    </div>
    <div class="debug-section">
      <div class="debug-section-title">VARIABLES</div>
      <div id="debug-variables">
        <div style="color: var(--text-muted); font-size: 12px;">Not debugging</div>
      </div>
    </div>
    <div class="debug-section">
      <div class="debug-section-title">BREAKPOINTS</div>
      <div id="debug-breakpoints" class="debug-breakpoints">
        <div style="color: var(--text-muted); font-size: 12px;">No breakpoints</div>
      </div>
    </div>
  `

  variablesContainer = document.getElementById('debug-variables')

  document.getElementById('dbg-start')?.addEventListener('click', () => {
    const event = new CustomEvent('debug-start-request')
    document.dispatchEvent(event)
  })
  document.getElementById('dbg-continue')?.addEventListener('click', () => window.axide.debugContinue())
  document.getElementById('dbg-step-over')?.addEventListener('click', () => window.axide.debugStepOver())
  document.getElementById('dbg-step-in')?.addEventListener('click', () => window.axide.debugStepIn())
  document.getElementById('dbg-step-out')?.addEventListener('click', () => window.axide.debugStepOut())
  document.getElementById('dbg-stop')?.addEventListener('click', stopDebug)

  // Subscribe to debug events
  unsubStopped?.()
  unsubStopped = window.axide.onDebugStopped((data) => {
    onDebugNavigate?.(data.file, data.line)
    setSteppingControls(true)
  })

  unsubOutput?.()
  unsubOutput = window.axide.onDebugOutput((text) => appendDebugOutput(text))

  unsubVars?.()
  unsubVars = window.axide.onDebugVariables((vars) => renderVariables(vars))

  unsubExited?.()
  unsubExited = window.axide.onDebugExited(() => {
    isDebugging = false
    setSteppingControls(false)
    setControlsEnabled(false)
    if (variablesContainer) {
      variablesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">Debug session ended</div>'
    }
  })

  updateBreakpointsUI()
}

export function updateBreakpointsUI(): void {
  const container = document.getElementById('debug-breakpoints')
  if (!container) return

  const bps = getBreakpoints()
  if (bps.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">No breakpoints</div>'
    return
  }

  container.innerHTML = bps.map(bp => {
    const filename = bp.file.split(/[\\/]/).pop() || bp.file
    return `
      <div class="debug-bp-item" data-file="${escapeHtml(bp.file)}" data-line="${bp.line}">
        <div class="debug-bp-dot"></div>
        <div class="debug-bp-location" title="${escapeHtml(bp.file)}">${escapeHtml(filename)}:${bp.line}</div>
        <button class="debug-bp-remove" title="Remove Breakpoint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `
  }).join('')

  // Add event listeners locally
  container.querySelectorAll('.debug-bp-item').forEach(item => {
    const el = item as HTMLElement
    const file = el.getAttribute('data-file')!
    const line = parseInt(el.getAttribute('data-line')!)

    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.debug-bp-remove')) {
        removeBreakpointAt(file, line)
        window.axide.debugRemoveBreakpoint(file, line)
        updateBreakpointsUI()
      } else {
        onDebugNavigate?.(file, line)
      }
    })
  })
}

export function startDebug(filePath: string): void {
  if (isDebugging) window.axide.debugStop()
  clearDebugConsole()
  isDebugging = true
  setControlsEnabled(true)
  if (variablesContainer) {
    variablesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">Starting debug session...</div>'
  }
  // Switch to debug console tab
  switchToDebugConsole()
  window.axide.debugStart(filePath)
}

export function stopDebug(): void {
  window.axide.debugStop()
  isDebugging = false
  setSteppingControls(false)
  setControlsEnabled(false)
}

function setControlsEnabled(enabled: boolean): void {
  const stop = document.getElementById('dbg-stop') as HTMLButtonElement
  if (stop) stop.disabled = !enabled
}

function setSteppingControls(enabled: boolean): void {
  const ids = ['dbg-continue', 'dbg-step-over', 'dbg-step-in', 'dbg-step-out']
  ids.forEach(id => {
    const btn = document.getElementById(id) as HTMLButtonElement
    if (btn) btn.disabled = !enabled
  })
}

function renderVariables(vars: DebugVariable[]): void {
  if (!variablesContainer) return
  if (vars.length === 0) {
    variablesContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 12px;">No local variables</div>'
    return
  }
  variablesContainer.innerHTML = vars.map(v =>
    `<div class="debug-var">
      <span><span class="debug-var-name">${escapeHtml(v.name)}</span><span class="debug-var-type"> : ${escapeHtml(v.type)}</span></span>
      <span class="debug-var-value">${escapeHtml(v.value)}</span>
    </div>`
  ).join('')
}

function switchToDebugConsole(): void {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'))
  document.querySelectorAll('.panel-body').forEach(p => p.classList.remove('active'))
  document.querySelector('[data-target="debug-console"]')?.classList.add('active')
  document.getElementById('debug-console')?.classList.add('active')
  document.getElementById('bottom-panel')?.classList.remove('panel-collapsed')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
