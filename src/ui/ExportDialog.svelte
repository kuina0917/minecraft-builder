<script lang="ts">
  import { getProject } from '../store/projectStore.svelte'
  import { exportBBModel } from '../export/bbmodel'
  import { exportBlockModel } from '../export/blockModel'
  import { exportItemModel } from '../export/itemModel'

  let { show = false, onclose = () => {} } = $props()

  let format = $state('bbmodel')
  let status = $state('')
  let fileName = $state('')

  $effect(() => {
    fileName = getProject().name.replace(/[^a-zA-Z0-9_\-]/g, '_')
  })

  function handleExport() {
    const project = getProject()

    try {
      let content = ''
      let ext = ''
      let mime = ''

      switch (format) {
        case 'bbmodel': {
          content = exportBBModel(project)
          ext = '.bbmodel'
          mime = 'application/json'
          break
        }
        case 'block': {
          content = exportBlockModel(project)
          ext = '.json'
          mime = 'application/json'
          break
        }
        case 'item': {
          content = exportItemModel()
          ext = '.json'
          mime = 'application/json'
          break
        }
      }

      const blob = new Blob([content], { type: mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName + ext
      a.click()
      URL.revokeObjectURL(url)

      status = 'エクスポート完了！'
    } catch (e) {
      status = 'エクスポートに失敗しました: ' + (e as Error).message
    }
  }

  function handleClose() {
    status = ''
    onclose()
  }
</script>

{#if show}
  <div class="overlay" onclick={handleClose} onkeydown={(e) => { if (e.key === 'Escape') handleClose() }} role="presentation">
    <div class="dialog" onclick={(e) => e.stopPropagation()} onkeydown={(e) => { if (e.key === 'Escape') handleClose() }} role="dialog" tabindex="-1">
      <h2 class="dialog-title">エクスポート</h2>

      <div class="field">
        <label for="export-format" class="field-label">形式</label>
        <select id="export-format" bind:value={format}>
          <option value="bbmodel">Blockbench (.bbmodel)</option>
          <option value="block">Minecraft Block Model (.json)</option>
          <option value="item">Minecraft Item Model (.json)</option>
        </select>
      </div>

      <div class="field">
        <label for="export-filename" class="field-label">ファイル名</label>
        <input id="export-filename" type="text" bind:value={fileName} />
      </div>

      {#if status}
        <div class="status" class:error={status.includes('失敗')}>
          {status}
        </div>
      {/if}

      <div class="actions">
        <button class="btn btn-secondary" onclick={handleClose}>キャンセル</button>
        <button class="btn btn-primary" onclick={handleExport}>エクスポート</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 24px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .dialog-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  .field {
    margin-bottom: 12px;
  }

  .field-label {
    display: block;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .field select,
  .field input {
    width: 100%;
    padding: 8px;
    border-radius: 4px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 14px;
  }

  .status {
    padding: 8px 12px;
    border-radius: 4px;
    background: var(--bg-surface);
    color: var(--text-primary);
    font-size: 13px;
    margin-bottom: 12px;
  }

  .status.error {
    background: rgba(233, 69, 96, 0.15);
    color: var(--accent);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    transition: background 0.15s;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
  }

  .btn-primary:hover {
    background: var(--accent-hover);
  }

  .btn-secondary {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover {
    background: var(--bg-surface);
  }
</style>
