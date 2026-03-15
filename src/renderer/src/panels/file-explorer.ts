import type { FileEntry } from '../env'

let rootPath = ''
let onFileSelected: ((path: string) => void) | null = null
let currentActive = ''
let contextMenu: HTMLElement | null = null

export function initFileExplorer(container: HTMLElement, fileSelectedCb: (path: string) => void): void {
  onFileSelected = fileSelectedCb

  document.addEventListener('click', () => hideContextMenu())
  document.addEventListener('contextmenu', (e) => {
    if (!(e.target as HTMLElement).closest('#file-tree')) {
      hideContextMenu()
    }
  })

  const treeContainer = document.getElementById('file-tree')
  if (treeContainer) {
    treeContainer.addEventListener('contextmenu', (e) => {
      if (e.target === treeContainer) {
        e.preventDefault()
        showContextMenu(e.clientX, e.clientY, null)
      }
    })
  }
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
    item.draggable = true

    const innerContent = document.createElement('div')
    innerContent.className = 'tree-item-content'
    innerContent.style.display = 'flex'
    innerContent.style.alignItems = 'center'
    innerContent.style.width = '100%'

    if (entry.isDirectory) {
      innerContent.innerHTML = `
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

      item.appendChild(innerContent)
      parent.appendChild(item)
      if (entry.children && entry.children.length > 0) {
        renderTree(entry.children, childContainer, depth + 1)
      }
      parent.appendChild(childContainer)
    } else {
      const ext = entry.name.split('.').pop() || ''
      const isAxe = ext === 'axe'
      innerContent.innerHTML = `
        <span class="tree-chevron" style="visibility:hidden">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M9 18l6-6-6-6"/></svg>
        </span>
        <span class="tree-icon" ${isAxe ? 'style="color: var(--teal)"' : ''}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="1.8"/><polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.8"/></svg>
        </span>
        <span class="tree-name">${escapeHtml(entry.name)}</span>
      `

      item.addEventListener('click', (e) => {
        e.stopPropagation()
        onFileSelected?.(entry.path)
      })

      if (entry.path === currentActive) item.classList.add('active')
      item.appendChild(innerContent)
      parent.appendChild(item)
    }

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      e.stopPropagation()
      showContextMenu(e.clientX, e.clientY, entry)
    })

    item.addEventListener('dragstart', (e) => {
      e.stopPropagation()
      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', entry.path)
        e.dataTransfer.effectAllowed = 'move'
      }
      item.style.opacity = '0.5'
    })

    item.addEventListener('dragend', () => {
      item.style.opacity = '1'
    })

    if (entry.isDirectory) {
      item.addEventListener('dragover', (e) => {
        e.preventDefault()
        e.stopPropagation()
        item.classList.add('drag-over')
      })

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over')
      })

      item.addEventListener('drop', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        item.classList.remove('drag-over')
        const srcPath = e.dataTransfer?.getData('text/plain')
        if (srcPath && srcPath !== entry.path) {
          const success = await window.axide.moveFile(srcPath, entry.path)
          if (success) await refreshTree()
        }
      })
    }
  }
}

function showContextMenu(x: number, y: number, entry: FileEntry | null) {
  hideContextMenu()

  contextMenu = document.createElement('div')
  contextMenu.className = 'context-menu'
  contextMenu.style.left = `${x}px`
  contextMenu.style.top = `${y}px`

  if (entry) {
    addContextItem(contextMenu, 'Show in File Manager', () => {
      window.axide.showItemInFolder(entry.path)
    })
    addContextItem(contextMenu, 'Rename', () => {
      startRename(entry)
    })
    addContextItem(contextMenu, 'Delete', async () => {
      const type = entry.isDirectory ? 'folder' : 'file'
      if (confirm(`Are you sure you want to delete this ${type}?`)) {
        const success = await window.axide.deleteFile(entry.path)
        if (success) await refreshTree()
      }
    })

    if (entry.isDirectory) {
      const separator = document.createElement('div')
      separator.className = 'context-menu-separator'
      contextMenu.appendChild(separator)

      addContextItem(contextMenu, 'New .axe File', () => {
        createNewItem('file', '.axe', entry.path)
      })
      addContextItem(contextMenu, 'New Folder', () => {
        createNewItem('directory', '', entry.path)
      })
    }
  } else {
    addContextItem(contextMenu, 'New .axe File', () => {
      createNewItem('file', '.axe')
    })
    addContextItem(contextMenu, 'New Folder', () => {
      createNewItem('directory')
    })
    addContextItem(contextMenu, 'New Empty File', () => {
      createNewItem('file', '')
    })
  }

  document.body.appendChild(contextMenu)

  const rect = contextMenu.getBoundingClientRect()
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`
  }
}

function addContextItem(menu: HTMLElement, label: string, onClick: () => void) {
  const item = document.createElement('div')
  item.className = 'context-menu-item'
  item.textContent = label
  item.onclick = (e) => {
    e.stopPropagation()
    onClick()
    hideContextMenu()
  }
  menu.appendChild(item)
}

function hideContextMenu() {
  if (contextMenu) {
    contextMenu.remove()
    contextMenu = null
  }
}

async function startRename(entry: FileEntry) {
  const item = document.querySelector(`[data-path="${CSS.escape(entry.path)}"]`)
  if (!item) return

  const nameEl = item.querySelector('.tree-name') as HTMLElement
  if (!nameEl) return

  const originalName = entry.name
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'tree-item-rename'
  input.value = originalName

  const oldNameEl = nameEl.cloneNode(true)
  nameEl.replaceWith(input)
  input.focus()

  const dotIndex = originalName.lastIndexOf('.')
  if (dotIndex > 0 && !entry.isDirectory) {
    input.setSelectionRange(0, dotIndex)
  } else {
    input.select()
  }

  const finishRename = async (commit: boolean) => {
    const newName = input.value.trim()
    if (commit && newName && newName !== originalName) {
      const separator = entry.path.includes('\\') ? '\\' : '/'
      const pathParts = entry.path.split(separator)
      pathParts[pathParts.length - 1] = newName
      const newPath = pathParts.join(separator)

      const success = await window.axide.renameFile(entry.path, newPath)
      if (success) {
        await refreshTree()
      } else {
        input.replaceWith(oldNameEl)
      }
    } else {
      input.replaceWith(oldNameEl)
    }
  }

  input.onkeydown = (e) => {
    if (e.key === 'Enter') finishRename(true)
    if (e.key === 'Escape') finishRename(false)
  }
  input.onblur = () => finishRename(true)
}

async function createNewItem(type: 'file' | 'directory', suffix: string = '', parentDir: string = rootPath) {
  if (!parentDir) {
    alert('Please open a folder first.')
    return
  }

  const defaultName = type === 'file' ? `new_file${suffix}` : 'new_folder'
  const name = prompt(`Enter ${type} name:`, defaultName)
  if (!name) return

  let finalName = name.trim()
  if (type === 'file' && suffix && !finalName.toLowerCase().endsWith(suffix.toLowerCase())) {
    finalName += suffix
  }

  const separator = parentDir.includes('\\') ? '\\' : '/'
  const fullPath = parentDir.endsWith(separator) ? parentDir + finalName : parentDir + separator + finalName

  let success = false
  if (type === 'file') {
    success = await window.axide.createFile(fullPath)
  } else {
    success = await window.axide.createDirectory(fullPath)
  }

  if (success) {
    await refreshTree()
    if (type === 'file') {
      onFileSelected?.(fullPath)
    }
  } else {
    alert(`Failed to create ${type}. Check if it already exists.`)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
