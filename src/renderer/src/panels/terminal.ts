let outputContainer: HTMLElement | null = null
let debugConsole: HTMLElement | null = null
let isRunning = false
let unsubOutput: (() => void) | null = null
let unsubExit: (() => void) | null = null

export function initTerminal(): void {
  outputContainer = document.getElementById('output-content')
  debugConsole = document.getElementById('debug-console')

  const btnStop = document.getElementById('btn-stop') as HTMLButtonElement

  // Run output handlers
  unsubOutput?.()
  unsubOutput = window.axide.onRunOutput((data) => {
    appendOutput(data)
  })

  unsubExit?.()
  unsubExit = window.axide.onRunExit((code) => {
    appendOutput(`\n━━━ Process exited with code ${code} ━━━\n`)
    isRunning = false
    if (btnStop) btnStop.disabled = true
    showPanel()
  })
}

export function runFile(filePath: string, mode: 'main' | 'test'): void {
  if (isRunning) window.axide.runStop()

  clearOutput()
  const fname = filePath.split(/[\\/]/).pop() || filePath
  appendOutput(`━━━ Running ${fname} (${mode}) ━━━\n\n`)
  isRunning = true

  const btnStop = document.getElementById('btn-stop') as HTMLButtonElement
  if (btnStop) btnStop.disabled = false

  showPanel()
  window.axide.runStart(filePath, mode)
}

export function stopRun(): void {
  window.axide.runStop()
  isRunning = false
  const btnStop = document.getElementById('btn-stop') as HTMLButtonElement
  if (btnStop) btnStop.disabled = true
}

export function appendOutput(text: string): void {
  if (!outputContainer) return
  const span = document.createElement('span')
  span.textContent = text
  outputContainer.appendChild(span)
  outputContainer.scrollTop = outputContainer.scrollHeight
}

export function appendDebugOutput(text: string): void {
  if (!debugConsole) return
  const span = document.createElement('span')
  span.textContent = text
  debugConsole.appendChild(span)
  debugConsole.scrollTop = debugConsole.scrollHeight
}

export function clearOutput(): void {
  if (outputContainer) outputContainer.innerHTML = ''
}

export function clearDebugConsole(): void {
  if (debugConsole) debugConsole.innerHTML = ''
}

function showPanel(): void {
  const panel = document.getElementById('bottom-panel')
  panel?.classList.remove('panel-collapsed')
}
