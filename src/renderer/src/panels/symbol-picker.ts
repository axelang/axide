import { getDocumentSymbols } from '../editor/lsp-client'
import { getActiveFilePath } from '../editor/editor'

interface DocumentSymbol {
  name: string
  kind: number
  range: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  children?: DocumentSymbol[]
}

let allSymbols: DocumentSymbol[] = []
let filteredSymbols: DocumentSymbol[] = []
let selectedIndex = 0
let onSymbolSelect: (line: number, character: number) => void = () => { }

export function initSymbolPicker(onSelect: (line: number, character: number) => void): void {
  onSymbolSelect = onSelect
  const input = document.getElementById('symbol-picker-input') as HTMLInputElement

  input.addEventListener('input', () => {
    updateResults(input.value)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, filteredSymbols.length - 1)
      renderResults()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
      renderResults()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredSymbols[selectedIndex]) {
        const symbol = filteredSymbols[selectedIndex]
        selectSymbol(symbol.range.start.line + 1, symbol.range.start.character + 1)
      }
    } else if (e.key === 'Escape') {
      hideSymbolPicker()
    }
  })

  const overlay = document.getElementById('modal-overlay')!
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      const modal = document.getElementById('symbol-picker-modal')!
      if (!modal.classList.contains('hidden')) {
        hideSymbolPicker()
      }
    }
  })
}

export async function showSymbolPicker(): Promise<void> {
  const filePath = getActiveFilePath()
  if (!filePath) return

  const symbols = await getDocumentSymbols(filePath)
  allSymbols = flattenSymbols(symbols)

  const overlay = document.getElementById('modal-overlay')!
  const modal = document.getElementById('symbol-picker-modal')!
  const input = document.getElementById('symbol-picker-input') as HTMLInputElement

  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'))

  overlay.classList.remove('hidden')
  modal.classList.remove('hidden')
  input.value = ''
  selectedIndex = 0

  updateResults('')
  input.focus()
}

export function hideSymbolPicker(): void {
  document.getElementById('modal-overlay')!.classList.add('hidden')
  document.getElementById('symbol-picker-modal')!.classList.add('hidden')
}

function flattenSymbols(symbols: DocumentSymbol[]): DocumentSymbol[] {
  const flattened: DocumentSymbol[] = []
  function walk(items: DocumentSymbol[], prefix = ''): void {
    for (const item of items) {
      const name = prefix ? `${prefix}.${item.name}` : item.name
      flattened.push({ ...item, name })
      if (item.children) {
        walk(item.children, name)
      }
    }
  }
  walk(symbols)
  return flattened
}

function updateResults(query: string): void {
  const q = query.toLowerCase().trim()

  if (!q) {
    filteredSymbols = allSymbols
  } else {
    filteredSymbols = allSymbols.filter(s => s.name.toLowerCase().includes(q))
  }

  selectedIndex = 0
  renderResults()
}

function renderResults(): void {
  const resultsContainer = document.getElementById('symbol-picker-results')!
  resultsContainer.innerHTML = ''

  filteredSymbols.forEach((symbol, index) => {
    const el = document.createElement('div')
    el.className = `quick-open-item symbol-item ${index === selectedIndex ? 'active' : ''}`

    const kindName = getSymbolKindName(symbol.kind)
    const icon = getSymbolIcon(symbol.kind)

    el.innerHTML = `
      <div class="quick-open-item-name">
        <span class="symbol-icon">${icon}</span>
        ${escapeHtml(symbol.name)}
      </div>
      <div class="quick-open-item-path">${kindName}</div>
    `

    el.onclick = () => selectSymbol(symbol.range.start.line + 1, symbol.range.start.character + 1)
    resultsContainer.appendChild(el)

    if (index === selectedIndex) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

function selectSymbol(line: number, character: number): void {
  onSymbolSelect(line, character)
  hideSymbolPicker()
}

function getSymbolKindName(kind: number): string {
  const kinds: Record<number, string> = {
    1: 'File', 2: 'Module', 3: 'Namespace', 4: 'Package', 5: 'Class', 6: 'Method',
    7: 'Property', 8: 'Field', 9: 'Constructor', 10: 'Enum', 11: 'Interface',
    12: 'Function', 13: 'Variable', 14: 'Constant', 15: 'String', 16: 'Number',
    17: 'Boolean', 18: 'Array', 19: 'Object', 20: 'Key', 21: 'Null', 22: 'EnumMember',
    23: 'Struct', 24: 'Event', 25: 'Operator', 26: 'TypeParameter'
  }
  return kinds[kind] || 'Symbol'
}

/**
 * Get the symbol icons.
 * 
 * For the moment, this is just a bunch of placeholders.
 * @param kind 
 * @returns 
 */
function getSymbolIcon(kind: number): string {
  switch (kind) {
    case 5: return '󰠱'
    case 12: return '󰊕'
    case 6: return '󰊕'
    case 13: return '󰫧'
    case 14: return '󰫧'
    case 11: return '󰠱'
    case 10: return '󰒚'
    case 23: return '󰠵'
    default: return '󰈚'
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
