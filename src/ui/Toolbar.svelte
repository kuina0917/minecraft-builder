<script lang="ts">
  import { getProject, undo, getSelectedPartIds, booleanAdd, booleanSubtract, booleanIntersect } from '../store/projectStore.svelte'
  import { getSelectionMode, setSelectionMode, getSnapUnit, setSnapUnit, getScaleAnchor, isBooleanMode, startBooleanMode, cancelBooleanMode, getBooleanOp } from '../store/placementStore.svelte'
  import { saveProject } from '../lib/partEncoder'
  import ExportDialog from './ExportDialog.svelte'
  import type { SelectionMode, BooleanOp } from '../types'

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

  function handleBoolean(op: BooleanOp) {
    const ids = getSelectedPartIds()
    if (ids.length >= 2) {
      switch (op) {
        case 'add': booleanAdd(ids[0], ids[1]); break
        case 'subtract': booleanSubtract(ids[0], ids[1]); break
        case 'intersect': booleanIntersect(ids[0], ids[1]); break
      }
    } else if (ids.length === 1) {
      startBooleanMode(op, ids[0])
    }
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
    {#if getSelectionMode() === 'scale'}
      <span class="anchor-compass">
        <span class="compass-cell" class:active={getScaleAnchor() === 'nw'}>NW</span>
        <span class="compass-cell" class:active={getScaleAnchor() === 'ne'}>NE</span>
        <span class="compass-cell" class:active={getScaleAnchor() === 'sw'}>SW</span>
        <span class="compass-cell" class:active={getScaleAnchor() === 'se'}>SE</span>
      </span>
    {/if}
    <span class="separator"></span>
    <button class="tool-btn" onclick={toggleSnap} title="スナップ単位を切替 (+/-)">
      Snap: {getSnapUnit()}
    </button>
    <span class="separator"></span>
    {#if isBooleanMode()}
      <button class="tool-btn boolean-active" onclick={cancelBooleanMode} title="ブーリアンモードをキャンセル (ESC)">
        {getBooleanOp() === 'add' ? '➕' : getBooleanOp() === 'subtract' ? '➖' : '∩'} 選択中... ✕
      </button>
    {:else}
      <button class="tool-btn boolean-add" onclick={() => handleBoolean('add')} disabled={getSelectedPartIds().length < 1} title="ブーリアン加算">➕ Add</button>
      <button class="tool-btn boolean-sub" onclick={() => handleBoolean('subtract')} disabled={getSelectedPartIds().length < 1} title="ブーリアン減算">➖ Sub</button>
      <button class="tool-btn boolean-int" onclick={() => handleBoolean('intersect')} disabled={getSelectedPartIds().length < 1} title="ブーリアン積集合">∩ Int</button>
    {/if}
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

  .anchor-compass {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    margin-left: 4px;
  }

  .compass-cell {
    padding: 1px 5px;
    font-size: 9px;
    text-align: center;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    line-height: 1.4;
  }

  .compass-cell.active {
    background: var(--accent);
    color: white;
  }

  .tool-btn.boolean-add:hover:not(:disabled) {
    background: #2ecc71;
    color: white;
  }

  .tool-btn.boolean-sub:hover:not(:disabled) {
    background: #e74c3c;
    color: white;
  }

  .tool-btn.boolean-int:hover:not(:disabled) {
    background: #3498db;
    color: white;
  }

  .tool-btn.boolean-active {
    background: var(--accent);
    color: white;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>
