<script lang="ts">
  import { getProject, undo } from '../store/projectStore.svelte'
  import { getSelectionMode, setSelectionMode, getSnapUnit, setSnapUnit } from '../store/placementStore.svelte'
  import { saveProject } from '../lib/partEncoder'
  import ExportDialog from './ExportDialog.svelte'
  import type { SelectionMode } from '../types'

  let showExport = $state(false)

  function handleNew() {
    if (confirm('現在のプロジェクトを破棄して新規作成しますか？')) {
      localStorage.removeItem('minecraft-builder:current')
      location.reload()
    }
  }

  function handleSave() {
    saveProject(getProject())
  }

  function handleExport() {
    showExport = true
  }

  function toggleSnap() {
    setSnapUnit(getSnapUnit() === 1.0 ? 0.5 : 1.0)
  }

  function changeMode(mode: SelectionMode) {
    setSelectionMode(mode)
  }
</script>

<header class="toolbar">
  <div class="toolbar-left">
    <span class="logo">⛏ MC Model Builder</span>
  </div>
  <div class="toolbar-center">
    <button class="tool-btn" onclick={handleNew} title="新規プロジェクト">新規</button>
    <button class="tool-btn" onclick={handleSave} title="保存 (Ctrl+S)">保存</button>
    <span class="separator"></span>
    <button class="tool-btn" onclick={undo} title="元に戻す (Ctrl+Z)">元に戻す</button>
    <span class="separator"></span>
    <button class="tool-btn" class:active={getSelectionMode() === 'object'} onclick={() => changeMode('object')} title="Objectモード [O]">Object</button>
    <button class="tool-btn" class:active={getSelectionMode() === 'face'} onclick={() => changeMode('face')} title="Face編集モード [F]">Face</button>
    <button class="tool-btn" class:active={getSelectionMode() === 'scale'} onclick={() => changeMode('scale')} title="Scaleモード [S]">Scale</button>
    <span class="separator"></span>
    <button class="tool-btn" onclick={toggleSnap} title="スナップ単位を切替 (+/-)">
      Snap: {getSnapUnit()}
    </button>
    <span class="separator"></span>
    <button class="tool-btn" onclick={handleExport} title="エクスポート (Ctrl+E)">エクスポート</button>
  </div>
  <div class="toolbar-right">
    <span class="project-name">{getProject().name}</span>
  </div>
</header>

<ExportDialog show={showExport} onclose={() => showExport = false} />

<style>
  .toolbar {
    height: var(--header-height);
    min-height: var(--header-height);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    user-select: none;
  }

  .toolbar-left, .toolbar-center, .toolbar-right {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .toolbar-left {
    min-width: 180px;
  }

  .toolbar-center {
    flex: 1;
    justify-content: center;
  }

  .toolbar-right {
    min-width: 120px;
    justify-content: flex-end;
  }

  .logo {
    font-weight: 700;
    color: var(--accent);
    font-size: 15px;
    letter-spacing: 0.5px;
  }

  .tool-btn {
    padding: 4px 12px;
    border-radius: 4px;
    color: var(--text-secondary);
    font-size: 13px;
    transition: background 0.15s, color 0.15s;
  }

  .tool-btn:hover:not(:disabled) {
    background: var(--bg-surface);
    color: var(--text-primary);
  }

  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .tool-btn.active {
    background: var(--accent);
    color: white;
  }

  .separator {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }

  .project-name {
    font-size: 12px;
    color: var(--text-secondary);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
