<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { ViewportManager } from './ViewportManager'
  import { getProject, selectPart, addPart, removePart, getRevision, getSelectedPartId, getSelectedPartIds, canPlaceAt } from '../store/projectStore.svelte'
  import { getPlacementType, setPlacementType, getSelectionMode } from '../store/placementStore.svelte'
  import { getShapeName } from '../parts/ShapeRegistry'

  let container: HTMLDivElement
  let manager: ViewportManager

  function getPartName(type: string): string {
    return getShapeName(type as any) ?? type
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!manager || manager.placement.active) return
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') (e.target as HTMLElement)?.blur()
      return
    }
  }

  onMount(() => {
    manager = new ViewportManager(container)

    manager.onSelect = (id) => {
      selectPart(id)
    }

    manager.placement.setCanPlace(canPlaceAt)

    manager.onAddPart = (type, pos) => {
      const part = addPart(type, getPartName(type), pos)
      if (part) manager.addPartToScene(part)
    }

    manager.start()
    document.addEventListener('keydown', handleKeyDown)
  })

  $effect(() => {
    getRevision()
    if (!manager) return
    if (manager.suppressRebuild) return
    const project = getProject()

    const currentIds = new Set(manager.partMeshes.keys())
    const storeIds = new Set(Object.keys(project.partMap))

    for (const id of storeIds) {
      if (!currentIds.has(id)) {
        const part = project.partMap[id]
        if (part) manager.addPartToScene(part)
      }
    }

    for (const id of currentIds) {
      if (!storeIds.has(id)) {
        manager.removePartFromScene(id)
      } else {
        manager.removePartFromScene(id)
        const part = project.partMap[id]
        if (part) manager.addPartToScene(part)
      }
    }

    // Update rotation gizmo on selection change
    const selectedId = getSelectedPartId()
    if (selectedId && getSelectionMode() === 'object') {
      manager.rotationController.show(selectedId, manager.scene)
    } else {
      manager.rotationController.hide()
    }
  })

  $effect(() => {
    const type = getPlacementType()
    if (!manager) return
    if (type) {
      manager.startPlacement(type)
      setPlacementType(null)
    }
  })

  // Sync highlight when selection changes from UI panel
  $effect(() => {
    const selectedId = getSelectedPartId()
    if (!manager) return
    manager.syncHighlight()
  })

  // Hide rotation gizmo when switching to face/scale mode
  $effect(() => {
    const mode = getSelectionMode()
    if (mode !== 'object' && manager) {
      manager.rotationController.hide()
      manager.faceEditor.clearHighlight()
    }
  })

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeyDown)
    manager?.dispose()
  })
</script>

<div bind:this={container} class="viewport"></div>

<style>
  .viewport {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .viewport :global(canvas) {
    display: block;
  }
</style>
