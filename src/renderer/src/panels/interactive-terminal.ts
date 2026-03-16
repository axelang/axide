import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let container: HTMLElement | null = null

export function initInteractiveTerminal(): void {
  container = document.getElementById('terminal-content')
  if (!container) return

  term = new Terminal({
    theme: {
      background: '#1a1b26',
      foreground: '#a9b1d6',
      cursor: '#f7768e',
      selectionBackground: '#33467c',
      black: '#32344a',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6'
    },
    fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace",
    fontSize: 14,
    cursorBlink: true,
    allowProposedApi: true
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

  term.open(container)
  fitAddon.fit()

  window.axide.terminalInit()

  term.onData((data) => {
    window.axide.terminalWrite(data)
  })

  term.attachCustomKeyEventHandler((e) => {
    if (e.ctrlKey && (e.key === 'j' || e.key === 'p') && e.type === 'keydown') {
      return false
    }
    return true
  })

  window.axide.onTerminalData((data) => {
    term?.write(data)
  })

  window.axide.onTerminalExit((code) => {
    term?.write(`\r\n\r\n[Process exited with code ${code}]\r\n`)
  })

  const resizeObserver = new ResizeObserver(() => {
    if (fitAddon) {
      fitAddon.fit()
      window.axide.terminalResize(term!.cols, term!.rows)
    }
  })
  resizeObserver.observe(container)
}

export function focusTerminal(): void {
  term?.focus()
}
