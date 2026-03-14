import type { FileEntry } from '../env'

let rootPath = ''
let onFileSelected: ((path: string) => void) | null = null
let currentActive = ''

export function initFileExplorer(container: HTMLElement, fileSelectedCb: (path: string) => void): void {
  onFileSelected = fileSelectedCb
}

export async function loadDirectory(dirPath: string): Promise<void> {
  rootPath = dirPath
  const tree = await window.axide.readDirectory(dirPath)
  const container = document.getElementById('file-tree')
  if (!container) return
  container.innerHTML = ''
  renderTree(tree, container, 0)
}

export function setActiveFile(filePath: string): void {
  currentActive = filePath
  document.querySelectorAll('.tree-item.active').forEach(el => el.classList.remove('active'))
  const el = document.querySelector(`[data-path="${CSS.escape(filePath)}"]`)
  if (el) el.classList.add('active')
}

export async function refreshTree(): Promise<void> {
  if (rootPath) await loadDirectory(rootPath)
}

export function getRootPath(): string { return rootPath }

function renderTree(entries: FileEntry[], parent: HTMLElement, depth: number): void {
  for (const entry of entries) {
    const item = document.createElement('div')
    item.className = `tree-item ${entry.isDirectory ? 'directory' : 'file'}`
    item.setAttribute('data-path', entry.path)
    item.style.paddingLeft = `${12 + depth * 16}px`

    if (entry.isDirectory) {
      item.innerHTML = `
        <span class="tree-chevron">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18l6-6-6-6"/></svg>
        </span>
        <span class="tree-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" stroke="currentColor" stroke-width="1.8"/></svg>
        </span>
        <span class="tree-name">${escapeHtml(entry.name)}</span>
      `

      const childContainer = document.createElement('div')
      childContainer.className = 'tree-children'

      item.addEventListener('click', (e) => {
        e.stopPropagation()
        const chevron = item.querySelector('.tree-chevron')
        chevron?.classList.toggle('expanded')
        childContainer.classList.toggle('expanded')
      })

      parent.appendChild(item)
      if (entry.children && entry.children.length > 0) {
        renderTree(entry.children, childContainer, depth + 1)
      }
      parent.appendChild(childContainer)
    } else {
      const ext = entry.name.split('.').pop() || ''
      const isAxe = ext === 'axe'
      item.innerHTML = `
        <span class="tree-chevron" style="visibility:hidden">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18l6-6-6-6"/></svg>
        </span>
        <span class="tree-icon" ${isAxe ? 'style="color: var(--purple)"' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.8"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.8"/></svg>
        </span>
        <span class="tree-name">${escapeHtml(entry.name)}</span>
      `

      item.addEventListener('click', (e) => {
        e.stopPropagation()
        onFileSelected?.(entry.path)
      })

      if (entry.path === currentActive) item.classList.add('active')
      parent.appendChild(item)
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
