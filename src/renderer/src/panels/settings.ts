import type { Settings } from '../env'

let currentSettings: Settings | null = null
let onSettingsChanged: ((settings: Settings) => void) | null = null

const DEFAULT_SETTINGS: Settings = {
  formatOnSave: true,
  theme: 'dark',
  fontSize: 14,
  tabSize: 4,
  axePath: 'axe',
  axelsPath: 'axels',
  axefmtPath: 'axefmt',
  gdbPath: 'gdb',
  lastOpenedFolder: '',
  lastOpenedFile: ''
}

export async function initSettings(container: HTMLElement, changedCb: (settings: Settings) => void): Promise<void> {
  onSettingsChanged = changedCb
  currentSettings = await window.axide.getSettings() || { ...DEFAULT_SETTINGS }

  container.innerHTML = `
    <div class="settings-group">
      <div class="settings-group-title">EDITOR</div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Format on Save</div>
          <div class="setting-desc">Automatically format code when saving</div>
        </div>
        <button class="toggle ${currentSettings.formatOnSave ? 'on' : ''}" id="set-format-on-save"></button>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Theme</div>
          <div class="setting-desc">Editor color theme</div>
        </div>
        <select class="setting-select" id="set-theme">
          <option value="dark" ${currentSettings.theme === 'dark' ? 'selected' : ''}>Dark</option>
          <option value="light" ${currentSettings.theme === 'light' ? 'selected' : ''}>Light</option>
        </select>
      </div>
      <div class="setting-row">
        <div><div class="setting-label">Font Size</div></div>
        <input type="number" class="setting-number" id="set-font-size" value="${currentSettings.fontSize}" min="8" max="32" />
      </div>
      <div class="setting-row">
        <div><div class="setting-label">Tab Size</div></div>
        <input type="number" class="setting-number" id="set-tab-size" value="${currentSettings.tabSize}" min="1" max="8" />
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group-title">EXECUTABLES</div>
      <div class="setting-row">
        <div><div class="setting-label">Axe Compiler</div></div>
        <input type="text" class="setting-text" id="set-axe-path" value="${esc(currentSettings.axePath)}" />
      </div>
      <div class="setting-row">
        <div><div class="setting-label">Axe LSP</div></div>
        <input type="text" class="setting-text" id="set-axels-path" value="${esc(currentSettings.axelsPath)}" />
      </div>
      <div class="setting-row">
        <div><div class="setting-label">Axe Formatter</div></div>
        <input type="text" class="setting-text" id="set-axefmt-path" value="${esc(currentSettings.axefmtPath)}" />
      </div>
      <div class="setting-row">
        <div><div class="setting-label">GDB Path</div></div>
        <input type="text" class="setting-text" id="set-gdb-path" value="${esc(currentSettings.gdbPath)}" />
      </div>
    </div>
  `

  // Toggle handler
  document.getElementById('set-format-on-save')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLElement
    btn.classList.toggle('on')
    updateSetting('formatOnSave', btn.classList.contains('on'))
  })

  // Select handler
  document.getElementById('set-theme')?.addEventListener('change', (e) => {
    updateSetting('theme', (e.target as HTMLSelectElement).value as 'dark' | 'light')
  })

  // Number handlers
  document.getElementById('set-font-size')?.addEventListener('change', (e) => {
    updateSetting('fontSize', parseInt((e.target as HTMLInputElement).value) || 14)
  })
  document.getElementById('set-tab-size')?.addEventListener('change', (e) => {
    updateSetting('tabSize', parseInt((e.target as HTMLInputElement).value) || 4)
  })

  // Text handlers
  const textFields: [string, keyof Settings][] = [
    ['set-axe-path', 'axePath'],
    ['set-axels-path', 'axelsPath'],
    ['set-axefmt-path', 'axefmtPath'],
    ['set-gdb-path', 'gdbPath']
  ]
  for (const [id, key] of textFields) {
    document.getElementById(id)?.addEventListener('change', (e) => {
      updateSetting(key, (e.target as HTMLInputElement).value)
    })
  }
}

function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  if (!currentSettings) return
  currentSettings[key] = value
  window.axide.setSettings(currentSettings)
  onSettingsChanged?.(currentSettings)
}

export function getSettings(): Settings {
  return currentSettings || { ...DEFAULT_SETTINGS }
}

function esc(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
