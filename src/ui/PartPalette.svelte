<script lang="ts">
  import { shapeDefinitions } from '../parts/ShapeRegistry'
  import { setPlacementType } from '../store/placementStore.svelte'
  import type { ShapeType } from '../types'

  function handlePartClick(type: ShapeType) {
    setPlacementType(type as any)
  }
</script>

<div class="palette">
  <h3 class="panel-title">パーツ</h3>
  <div class="parts-grid">
    {#each shapeDefinitions as part, i}
      <button
        class="part-card"
        onclick={() => handlePartClick(part.type)}
        title="{part.name} (キー: {i + 1})"
      >
        <div class="part-icon">{part.icon}</div>
        <span class="part-name">{part.name}</span>
        <span class="part-key">{i + 1}</span>
      </button>
    {/each}
  </div>
  <div class="shortcuts-hint">
    <span class="hint-text">ショートカット: 1-7 でパーツ選択</span>
  </div>
  <h3 class="panel-title" style="margin-top: 16px;">ライブラリ</h3>
  <div class="library-empty">
    <p>保存済みパーツはここに表示されます</p>
  </div>
</div>

<style>
  .palette {
    padding: 12px;
    display: flex;
    flex-direction: column;
  }

  .panel-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }

  .parts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .part-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px;
    border-radius: 6px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    transition: background 0.15s, border-color 0.15s;
    cursor: pointer;
    position: relative;
  }

  .part-card:hover {
    background: var(--bg-surface);
    border-color: var(--accent);
  }

  .part-icon {
    font-size: 24px;
    line-height: 1;
  }

  .part-name {
    font-size: 11px;
    color: var(--text-secondary);
    text-align: center;
  }

  .part-key {
    font-size: 9px;
    color: var(--text-tertiary, #555);
    background: var(--bg-surface);
    padding: 0 4px;
    border-radius: 2px;
    position: absolute;
    top: 2px;
    right: 2px;
  }

  .shortcuts-hint {
    margin-top: 8px;
    text-align: center;
  }

  .hint-text {
    font-size: 10px;
    color: var(--text-tertiary, #555);
  }

  .library-empty {
    padding: 16px 8px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
    border: 1px dashed var(--border);
    border-radius: 6px;
  }

  .library-empty p {
    margin: 0;
  }
</style>
