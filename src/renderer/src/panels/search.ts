import { getRootPath } from './file-explorer'
import type { FileEntry } from '../env'

let searchInput: HTMLInputElement
let replaceInput: HTMLInputElement
let resultsContainer: HTMLElement
let onGoToFile: ((file: string, line: number, col: number) => void) | null = null

interface SearchResult {
  file: string
  line: number
  col: number
  lineContent: string
  matchLen: number
}

export function initSearch(container: HTMLElement, goToFileCb: (file: string, line: number, col: number) => void): void {
  onGoToFile = goToFileCb

  container.innerHTML = `
    <div class="search-input-group">
      <input type="text" class="search-input" id="search-query" placeholder="Search in files..." autocomplete="off" />
      <input type="text" class="search-input" id="search-replace" placeholder="Replace with..." autocomplete="off" />
      <div class="search-actions">
        <button class="search-btn" id="btn-search">Search</button>
        <button class="search-btn" id="btn-replace-all">Replace All</button>
      </div>
    </div>
    <div class="search-results" id="search-results"></div>
  `

  searchInput = document.getElementById('search-query') as HTMLInputElement
  replaceInput = document.getElementById('search-replace') as HTMLInputElement
  resultsContainer = document.getElementById('search-results') as HTMLElement

  document.getElementById('btn-search')?.addEventListener('click', performSearch)
  document.getElementById('btn-replace-all')?.addEventListener('click', performReplaceAll)

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch()
  })
}

async function performSearch(): Promise<void> {
  const query = searchInput.value
  if (!query || !getRootPath()) return

  resultsContainer.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted);">Searching...</div>'

  const results = await searchInDirectory(getRootPath(), query)
  renderResults(results, query)
}

async function searchInDirectory(dirPath: string, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  const entries = await window.axide.readDirectory(dirPath)
  await searchEntries(entries, query, results)
  return results
}

async function searchEntries(entries: FileEntry[], query: string, results: SearchResult[]): Promise<void> {
  for (const entry of entries) {
    if (entry.isDirectory && entry.children) {
      await searchEntries(entry.children, query, results)
    } else if (!entry.isDirectory && entry.name.endsWith('.axe')) {
      const content = await window.axide.readFile(entry.path)
      if (!content) continue
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        let col = lines[i].indexOf(query)
        while (col !== -1) {
          results.push({
            file: entry.path,
            line: i + 1,
            col: col + 1,
            lineContent: lines[i].trim(),
            matchLen: query.length
          })
          col = lines[i].indexOf(query, col + 1)
        }
      }
    }
    if (results.length > 500) return // Cap results
  }
}

function renderResults(results: SearchResult[], query: string): void {
  if (results.length === 0) {
    resultsContainer.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted);">No results found</div>'
    return
  }

  // Group by file
  const grouped: Map<string, SearchResult[]> = new Map()
  for (const r of results) {
    const arr = grouped.get(r.file) || []
    arr.push(r)
    grouped.set(r.file, arr)
  }

  let html = `<div style="padding: 4px 12px; color: var(--text-muted); font-size: 11px;">${results.length} results in ${grouped.size} files</div>`

  for (const [file, fileResults] of grouped) {
    const shortName = file.split(/[\\/]/).pop() || file
    html += `<div class="search-result-file">${escapeHtml(shortName)} <span style="color:var(--text-muted)">(${fileResults.length})</span></div>`

    for (const r of fileResults) {
      const before = r.lineContent.substring(0, r.col - 1)
      const match = r.lineContent.substring(r.col - 1, r.col - 1 + r.matchLen)
      const after = r.lineContent.substring(r.col - 1 + r.matchLen)
      html += `<div class="search-result-line" data-file="${escapeHtml(r.file)}" data-line="${r.line}" data-col="${r.col}">
        <span style="color:var(--text-muted);min-width:32px;display:inline-block">${r.line}</span>
        ${escapeHtml(before)}<span class="search-match">${escapeHtml(match)}</span>${escapeHtml(after)}
      </div>`
    }
  }

  resultsContainer.innerHTML = html

  // Click handlers for results
  resultsContainer.querySelectorAll('.search-result-line').forEach(el => {
    el.addEventListener('click', () => {
      const file = el.getAttribute('data-file')!
      const line = parseInt(el.getAttribute('data-line')!)
      const col = parseInt(el.getAttribute('data-col')!)
      onGoToFile?.(file, line, col)
    })
  })
}

async function performReplaceAll(): Promise<void> {
  const query = searchInput.value
  const replacement = replaceInput.value
  if (!query || !getRootPath()) return

  const entries = await window.axide.readDirectory(getRootPath())
  let totalReplacements = 0
  let filesChanged = 0

  await replaceInEntries(entries, query, replacement, (count) => {
    totalReplacements += count
    if (count > 0) filesChanged++
  })

  resultsContainer.innerHTML = `<div style="padding: 8px 12px; color: var(--green);">
    Replaced ${totalReplacements} occurrences in ${filesChanged} files
  </div>`
}

async function replaceInEntries(
  entries: FileEntry[], query: string, replacement: string,
  onReplace: (count: number) => void
): Promise<void> {
  for (const entry of entries) {
    if (entry.isDirectory && entry.children) {
      await replaceInEntries(entry.children, query, replacement, onReplace)
    } else if (!entry.isDirectory && entry.name.endsWith('.axe')) {
      const content = await window.axide.readFile(entry.path)
      if (!content || !content.includes(query)) { onReplace(0); continue }

      let count = 0
      const newContent = content.replace(new RegExp(escapeRegex(query), 'g'), () => { count++; return replacement })
      await window.axide.writeFile(entry.path, newContent)
      onReplace(count)
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
