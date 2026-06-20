<script lang="ts">
  import { getProject, getSelectedPartId, isWireframeEnabled } from '../store/projectStore.svelte'
  import { getSelectionMode, getSnapUnit } from '../store/placementStore.svelte'
  import { getShapeName } from '../parts/ShapeRegistry'

  let partInfo = $derived.by(() => {
    const id = getSelectedPartId()
    if (!id) return null
    const part = getProject().partMap[id]
    if (!part) return null
    const pos = `${part.transform.position[0]}, ${part.transform.position[1]}, ${part.transform.position[2]}`
    return `選択: ${part.name} (${getShapeName(part.elements[0]?.shape?.type ?? 'box')}) | 座標: ${pos}`
  })

  let modeText = $derived.by(() => {
    const m = getSelectionMode()
    const shortcuts: Record<string, string> = {
      object: 'Object [O]',
      face: 'Face [F]',
      scale: 'Scale [S]',
    }
    return shortcuts[m] ?? m
  })
</script>

<footer class="statusbar">
  <span class="status-text">{partInfo ?? '準備完了'}</span>
  <span class="status-right">
    {modeText} | Wireframe: {isWireframeEnabled() ? 'ON [W]' : 'OFF'} | Snap: {getSnapUnit()} [+/-] | 1-7: Parts
  </span>
</footer>

<style>
  .statusbar {
    height: 24px;
    min-height: 24px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-size: 11px;
    color: var(--text-secondary);
    user-select: none;
  }

  .status-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-right {
    text-align: right;
    white-space: nowrap;
    margin-left: 12px;
  }
</style>
