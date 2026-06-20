<script lang="ts">
  import { getProject, getSelectedPartIds, selectPart, toggleSelectPart, mergeSelected, ungroupSelected, splitSelected, toggleVisibility, booleanAdd, booleanSubtract, booleanIntersect } from '../store/projectStore.svelte'
  import { getBooleanOp, setBooleanOp, getBooleanSourceId, setBooleanSourceId } from '../store/placementStore.svelte'
  import { getShapeIcon, getShapeName } from '../parts/ShapeRegistry'
  import type { Part } from '../types'

  let dragStartId = $state<string | null>(null)
  let didDrag = false
  let collapsedGroups = $state<Set<string>>(new Set())

  function getPartIcon(part: Part): string {
    return getShapeIcon(part.elements[0]?.shape?.type ?? 'box')
  }

  function handlePointerDown(e: PointerEvent, id: string) {
    dragStartId = id
    didDrag = false
    if (e.ctrlKey) return
    selectPart(id)
  }

  function handlePointerEnter(id: string) {
    if (dragStartId === null) return
    didDrag = true
    const parts = getProject().rootParts
    const startIdx = parts.indexOf(dragStartId)
    const endIdx = parts.indexOf(id)
    if (startIdx === -1 || endIdx === -1) return
    const from = Math.min(startIdx, endIdx)
    const to = Math.max(startIdx, endIdx)
    const range = parts.slice(from, to + 1)
    selectPart(range[0])
    for (let i = 1; i < range.length; i++) {
      const sid = range[i]
      if (!getSelectedPartIds().includes(sid)) toggleSelectPart(sid)
    }
  }

  function handlePointerUp() {
    dragStartId = null
  }

  function toggleCollapse(id: string) {
    const next = new Set(collapsedGroups)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    collapsedGroups = next
  }

  function handleClick(e: MouseEvent, id: string) {
    if (didDrag) return
    if (e.ctrlKey) {
      toggleSelectPart(id)
    } else {
      selectPart(id)
    }
  }

  function getChildren(parentId: string): Part[] {
    return Object.values(getProject().partMap).filter((p) => p.parentId === parentId)
  }

  let booleanActive = $derived(getBooleanOp() !== null)
  let booleanSourceId = $derived(getBooleanSourceId())

  function startBooleanOp(op: 'add' | 'subtract' | 'intersect') {
    const ids = getSelectedPartIds()
    if (ids.length < 2) return
    const sourceId = ids[0]
    const targetId = ids[1]
    switch (op) {
      case 'add': booleanAdd(sourceId, targetId); break
      case 'subtract': booleanSubtract(sourceId, targetId); break
      case 'intersect': booleanIntersect(sourceId, targetId); break
    }
  }
</script>

<div class="hierarchy">
  <h3 class="panel-title">階層</h3>

  {#if getProject().rootParts.length === 0}
    <div class="tree-empty">
      <p>まだパーツがありません</p>
    </div>
  {:else}
    <div class="tree">
      {#each getProject().rootParts as partId}
        {@const part = getProject().partMap[partId]}
        {#if part}
          <div
            class="tree-item"
            class:selected={getSelectedPartIds().includes(part.id)}
            role="button"
            tabindex="0"
            onclick={(e) => handleClick(e, part.id)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e, part.id) }}
            onpointerdown={(e) => handlePointerDown(e, part.id)}
            onpointerenter={() => handlePointerEnter(part.id)}
            onpointerup={handlePointerUp}
          >
            {#if getChildren(part.id).length > 0}
              <span
                class="collapse-toggle"
                role="button"
                tabindex="0"
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleCollapse(part.id) } }}
                onclick={(e) => { e.stopPropagation(); toggleCollapse(part.id) }}
                title={collapsedGroups.has(part.id) ? '展開' : '折りたたむ'}
              >{collapsedGroups.has(part.id) ? '▶' : '▼'}</span>
            {:else}
              <span class="collapse-toggle" style="visibility:hidden">▼</span>
            {/if}
            <span class="vis-toggle" role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleVisibility(part.id) } }} onclick={(e) => { e.stopPropagation(); toggleVisibility(part.id) }} title={part.visible ? '非表示' : '表示'}>
              {part.visible ? '👁' : '👁‍🗨'}
            </span>
            <span class="tree-icon">{getPartIcon(part)}</span>
            <span class="tree-name" class:hidden={!part.visible}>{part.name}</span>
            <span class="tree-type">{getShapeName(part.elements[0]?.shape?.type ?? 'box')}</span>
          </div>
          {#if getChildren(part.id).length > 0 && !collapsedGroups.has(part.id)}
            {#each getChildren(part.id) as child}
              <div
                class="tree-item tree-child"
                class:selected={getSelectedPartIds().includes(child.id)}
                role="button"
                tabindex="0"
                onclick={(e) => handleClick(e, child.id)}
                onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e, child.id) }}
              >
                <span class="vis-toggle" role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleVisibility(child.id) } }} onclick={(e) => { e.stopPropagation(); toggleVisibility(child.id) }} title={child.visible ? '非表示' : '表示'}>
                  {child.visible ? '👁' : '👁‍🗨'}
                </span>
                <span class="tree-icon">{getPartIcon(child)}</span>
                <span class="tree-name" class:hidden={!child.visible}>{child.name}</span>
                <span class="tree-type">{getShapeName(child.shape.type)}</span>
              </div>
            {/each}
          {/if}
        {/if}
      {/each}
    </div>
  {/if}

  <div class="hierarchy-actions">
    <button
      class="action-btn"
      onclick={mergeSelected}
      disabled={getSelectedPartIds().length < 2}
      title="選択したパーツをグループ化 (Ctrl+G)"
    >グループ化</button>
    <button
      class="action-btn"
      onclick={ungroupSelected}
      disabled={getSelectedPartIds().length !== 1}
      title="グループを解除 (Ctrl+Shift+G)"
    >グループ解除</button>
    <button
      class="action-btn"
      onclick={splitSelected}
      disabled={getSelectedPartIds().length !== 1}
      title="パーツを1x1x1に分割"
    >分割</button>
  </div>

  <div class="hierarchy-actions" style="border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px;">
    <button
      class="action-btn boolean-add"
      onclick={() => startBooleanOp('add')}
      disabled={getSelectedPartIds().length < 2}
      title="ブーリアン加算"
    >➕ Add</button>
    <button
      class="action-btn boolean-sub"
      onclick={() => startBooleanOp('subtract')}
      disabled={getSelectedPartIds().length < 2}
      title="ブーリアン減算 (穴あけ)"
    >➖ Sub</button>
    <button
      class="action-btn boolean-int"
      onclick={() => startBooleanOp('intersect')}
      disabled={getSelectedPartIds().length < 2}
      title="ブーリアン積集合"
    >∩ Int</button>
  </div>
</div>

<style>
  .hierarchy {
    padding: 12px;
    flex: 1;
    overflow-y: auto;
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

  .tree-empty {
    padding: 24px 8px;
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
  }

  .tree-empty p {
    margin: 0;
  }

  .tree {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .tree-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 4px;
    background: transparent;
    transition: background 0.15s;
    text-align: left;
    width: 100%;
    cursor: pointer;
    border: 1px solid transparent;
    box-sizing: border-box;
  }

  .tree-item:hover {
    background: var(--bg-surface);
  }

  .tree-item.selected {
    background: var(--bg-surface);
    border-color: var(--accent);
  }

  .tree-child {
    padding-left: 32px;
  }

  .vis-toggle {
    cursor: pointer;
    font-size: 12px;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
    user-select: none;
  }

  .collapse-toggle {
    cursor: pointer;
    font-size: 10px;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
    user-select: none;
    color: var(--text-secondary);
    transition: color 0.15s;
  }

  .collapse-toggle:hover {
    color: var(--text-primary);
  }

  .hidden {
    opacity: 0.4;
    text-decoration: line-through;
  }

  .tree-icon {
    font-size: 14px;
    width: 20px;
    text-align: center;
    flex-shrink: 0;
  }

  .tree-name {
    flex: 1;
    font-size: 12px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-type {
    font-size: 10px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    padding: 1px 4px;
    border-radius: 3px;
  }

  .hierarchy-actions {
    display: flex;
    gap: 4px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    margin-top: 8px;
  }

  .action-btn {
    flex: 1;
    padding: 6px 8px;
    border-radius: 4px;
    font-size: 12px;
    color: var(--text-primary);
    background: var(--bg-surface);
    transition: background 0.15s;
  }

  .action-btn:hover:not(:disabled) {
    background: var(--accent);
    color: white;
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .boolean-add:hover:not(:disabled) {
    background: #2ecc71;
  }

  .boolean-sub:hover:not(:disabled) {
    background: #e74c3c;
  }

  .boolean-int:hover:not(:disabled) {
    background: #3498db;
  }
</style>
