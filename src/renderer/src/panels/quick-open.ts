import { getRootPath } from './file-explorer'

interface QuickOpenFile {
  name: string
  path: string
  axe: boolean
}

let allFiles: QuickOpenFile[] = []
let selectedIndex = 0
let filteredFiles: QuickOpenFile[] = []
let onFileSelect: (path: string) => void = () => {}

export function initQuickOpen(onSelect: (path: string) => void): void {
  onFileSelect = onSelect
  const input = document.getElementById('quick-open-input') as HTMLInputElement
  
  input.addEventListener('input', () => {
    updateResults(input.value)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedIndex = Math.min(selectedIndex + 1, filteredFiles.length - 1)
      renderResults()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedIndex = Math.max(selectedIndex - 1, 0)
      renderResults()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredFiles[selectedIndex]) {
        selectFile(filteredFiles[selectedIndex].path)
      }
    } else if (e.key === 'Escape') {
      hideQuickOpen()
    }
  })

  // Close on overlay click
  const overlay = document.getElementById('modal-overlay')!
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      const modal = document.getElementById('quick-open-modal')!
      if (!modal.classList.contains('hidden')) {
        hideQuickOpen()
      }
    }
  })
}

async function fetchAllFiles(): Promise<QuickOpenFile[]> {
  const root = getRootPath()
  if (!root) return []
  
  const entries = await window.axide.readDirectory(root)
  const flattened: QuickOpenFile[] = []
  
  function flatten(items: any[]): void {
    for (const item of items) {
      if (item.isDirectory) {
        if (item.children) flatten(item.children)
      } else {
        flattened.push({
          name: item.name,
          path: item.path,
          axe: item.name.toLowerCase().endsWith('.axe')
        })
      }
    }
  }
  
  flatten(entries)
  return flattened
}

export async function showQuickOpen(): Promise<void> {
  const overlay = document.getElementById('modal-overlay')!
  const modal = document.getElementById('quick-open-modal')!
  const input = document.getElementById('quick-open-input') as HTMLInputElement
  
  // Hide all other modals first if any
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'))
  
  allFiles = await fetchAllFiles()
  
  overlay.classList.remove('hidden')
  modal.classList.remove('hidden')
  input.value = ''
  selectedIndex = 0
  
  updateResults('')
  input.focus()
}

export function hideQuickOpen(): void {
  document.getElementById('modal-overlay')!.classList.add('hidden')
  document.getElementById('quick-open-modal')!.classList.add('hidden')
}

function updateResults(query: string): void {
  const q = query.toLowerCase().trim()
  
  if (!q) {
    // Just show first 50 files, axe first
    filteredFiles = [...allFiles].sort((a, b) => {
      if (a.axe && !b.axe) return -1
      if (!a.axe && b.axe) return 1
      return a.name.localeCompare(b.name)
    }).slice(0, 50)
  } else {
    // Search logic with prioritization
    filteredFiles = allFiles
      .filter(f => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        
        // 1. Exact match on filename
        const aExact = aName === q
        const bExact = bName === q
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1
        
        // 2. Starts with query
        const aStarts = aName.startsWith(q)
        const bStarts = bName.startsWith(q)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1

        // 3. .axe priority
        if (a.axe && !b.axe) return -1
        if (!a.axe && b.axe) return 1
        
        return a.name.localeCompare(b.name)
      })
      .slice(0, 50)
  }
  
  selectedIndex = 0
  renderResults()
}

function renderResults(): void {
  const resultsContainer = document.getElementById('quick-open-results')!
  resultsContainer.innerHTML = ''
  
  const root = getRootPath()
  
  filteredFiles.forEach((file, index) => {
    const el = document.createElement('div')
    el.className = `quick-open-item ${file.axe ? 'axe' : ''} ${index === selectedIndex ? 'active' : ''}`
    
    const relativePath = root ? file.path.replace(root, '').replace(/^[\\/]/, '') : file.path
    
    // Highlight match in name if possible
    const query = (document.getElementById('quick-open-input') as HTMLInputElement).value.toLowerCase().trim()
    let nameHtml = escapeHtml(file.name)
    if (query && file.name.toLowerCase().includes(query)) {
      const idx = file.name.toLowerCase().indexOf(query)
      const part1 = escapeHtml(file.name.substring(0, idx))
      const part2 = escapeHtml(file.name.substring(idx, idx + query.length))
      const part3 = escapeHtml(file.name.substring(idx + query.length))
      nameHtml = `${part1}<span class="quick-open-item-match">${part2}</span>${part3}`
    }

    el.innerHTML = `
      <div class="quick-open-item-name">${nameHtml}</div>
      <div class="quick-open-item-path">${escapeHtml(relativePath)}</div>
    `
    
    el.onclick = () => selectFile(file.path)
    resultsContainer.appendChild(el)
    
    if (index === selectedIndex) {
      el.scrollIntoView({ block: 'nearest' })
    }
  })
}

function selectFile(path: string): void {
  onFileSelect(path)
  hideQuickOpen()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
