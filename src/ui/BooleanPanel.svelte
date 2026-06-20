<script lang="ts">
  import { getProject, getSelectedPartIds, selectPart, booleanAdd, booleanSubtract, booleanIntersect } from '../store/projectStore.svelte'
  import { isBooleanMode, getBooleanOp, getBooleanSourceId, setBooleanSourceId, startBooleanMode, cancelBooleanMode } from '../store/placementStore.svelte'
  import { getShapeName } from '../parts/ShapeRegistry'
  import type { BooleanOp } from '../types'

  let booleanActive = $derived(isBooleanMode())
  let booleanOp = $derived(getBooleanOp())
  let booleanSourceId = $derived(getBooleanSourceId())

  let sourceName = $derived.by(() => {
    if (!booleanSourceId) return null
    const part = getProject().partMap[booleanSourceId]
    return part ? part.name : null
  })

  function startOp(op: BooleanOp) {
    cancelBooleanMode()
    startBooleanMode(op, '')
  }

  function handlePartClick(id: string) {
    if (!booleanActive) return
    if (!getBooleanSourceId()) {
      setBooleanSourceId(id)
    } else {
      const sourceId = getBooleanSourceId()
      const op = getBooleanOp()
      if (sourceId && op && id !== sourceId) {
        switch (op) {
          case 'add': booleanAdd(sourceId, id); break
          case 'subtract': booleanSubtract(sourceId, id); break
          case 'intersect': booleanIntersect(sourceId, id); break
        }
      }
      cancelBooleanMode()
    }
  }

  function cancel() {
    cancelBooleanMode()
  }
</script>

<div class="boolean-panel">
  {#if booleanActive}
    <div class="active-mode">
      <div class="mode-header" class:step2={!booleanSourceId}>
        {#if booleanOp === 'add'}
          <span class="mode-emoji">🔗</span>
          <span class="mode-title">結合</span>
        {:else if booleanOp === 'subtract'}
          <span class="mode-emoji">✂️</span>
          <span class="mode-title">削除</span>
        {:else}
          <span class="mode-emoji">🔲</span>
          <span class="mode-title">重なった部分だけ残す</span>
        {/if}
      </div>

      <div class="steps">
        <div class="step" class:done={booleanSourceId}>
          <span class="step-num">1</span>
          <span class="step-text">
            {#if booleanSourceId}
              <strong>{sourceName}</strong> を選択済み
            {:else}
              ベースとなるパーツを<strong>クリック</strong>
            {/if}
          </span>
        </div>
        <div class="step-arrow">↓</div>
        <div class="step" class:active={!booleanSourceId}>
          <span class="step-num">2</span>
          <span class="step-text">
            {#if booleanSourceId}
              {#if booleanOp === 'add'}
                くっつけたいパーツを<strong>クリック</strong>
              {:else if booleanOp === 'subtract'}
                削除したいパーツを<strong>クリック</strong>
              {:else}
                残したいパーツを<strong>クリック</strong>
              {/if}
            {:else}
              上のステップを完了してください
            {/if}
          </span>
        </div>
      </div>

      <button class="cancel-btn" onclick={cancel}>✕ キャンセル</button>
    </div>
  {:else}
    <div class="op-list">
      <button class="op-card add" onclick={() => startOp('add')}>
        <span class="op-icon">🔗</span>
        <div class="op-info">
          <span class="op-name">結合</span>
          <span class="op-desc">パーツをベースにくっつける</span>
        </div>
        <span class="op-arrow">›</span>
      </button>

      <button class="op-card subtract" onclick={() => startOp('subtract')}>
        <span class="op-icon">✂️</span>
        <div class="op-info">
          <span class="op-name">削除</span>
          <span class="op-desc">選択したパーツを削除する</span>
        </div>
        <span class="op-arrow">›</span>
      </button>

      <button class="op-card intersect" onclick={() => startOp('intersect')}>
        <span class="op-icon">🔲</span>
        <div class="op-info">
          <span class="op-name">重なった部分だけ残す</span>
          <span class="op-desc">2つが重なっている部分のみ残す</span>
        </div>
        <span class="op-arrow">›</span>
      </button>
    </div>

    <div class="tips">
      <div class="tip">
        <span class="tip-icon">💡</span>
        <span class="tip-text">パーツを2つ選択してからボタンを押すと即実行</span>
      </div>
      <div class="tip">
        <span class="tip-icon">💡</span>
        <span class="tip-text">ESC でキャンセル</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .boolean-panel {
    padding: 12px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .op-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .op-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 8px;
    background: var(--bg-surface);
    border: 2px solid var(--border);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .op-card:hover {
    transform: translateX(4px);
  }

  .op-card.add:hover {
    border-color: #2ecc71;
    background: rgba(46, 204, 113, 0.1);
  }

  .op-card.subtract:hover {
    border-color: #e74c3c;
    background: rgba(231, 76, 60, 0.1);
  }

  .op-card.intersect:hover {
    border-color: #3498db;
    background: rgba(52, 152, 219, 0.1);
  }

  .op-icon {
    font-size: 24px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border-radius: 8px;
  }

  .op-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .op-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .op-desc {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .op-arrow {
    font-size: 20px;
    color: var(--text-secondary);
  }

  .tips {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    background: var(--bg-surface);
    border-radius: 8px;
  }

  .tip {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .tip-icon {
    font-size: 12px;
  }

  .active-mode {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    background: var(--bg-surface);
    border-radius: 8px;
    border: 2px solid var(--accent);
  }

  .mode-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border);
  }

  .mode-emoji {
    font-size: 28px;
  }

  .mode-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 6px;
    background: var(--bg-secondary);
    transition: all 0.2s;
  }

  .step.done {
    background: rgba(46, 204, 113, 0.15);
    border: 1px solid #2ecc71;
  }

  .step.active {
    background: rgba(52, 152, 219, 0.15);
    border: 1px solid var(--accent);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .step-num {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--border);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
  }

  .step.done .step-num {
    background: #2ecc71;
    color: white;
  }

  .step.active .step-num {
    background: var(--accent);
    color: white;
  }

  .step-text {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .step-text strong {
    color: var(--accent);
  }

  .step-arrow {
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .cancel-btn {
    width: 100%;
    padding: 10px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    background: #e74c3c;
    color: white;
    border-color: #e74c3c;
  }
</style>
