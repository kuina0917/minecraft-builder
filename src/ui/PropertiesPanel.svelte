<script lang="ts">
  import { getProject, getSelectedPartId, selectPart, updatePart, removePart, updateTransform, addElement, removeElement, updateElementParam, updateElementTransform, snapshot, rescalePart } from '../store/projectStore.svelte'
  import { getSelectionMode } from '../store/placementStore.svelte'
  import { getParamList, getShapeName, getDefaultParams } from '../parts/ShapeRegistry'
  import type { Part, ShapeType } from '../types'

  let currentId = $state<string | null>(null)
  let currentPart = $state<Part | null>(null)
  let selectedElement = $state(0)
  let collapsedSections = $state<Set<string>>(new Set(['pivot', 'elemPivot', 'scale']))

  const shapeTypes: ShapeType[] = ['box', 'radial', 'sphere', 'wedge', 'ring', 'pipe', 'air']

  function loadPart(id: string | null) {
    currentId = id
    if (!id) { currentPart = null; return }
    const part = getProject().partMap[id]
    if (!part) { currentPart = null; return }
    currentPart = { ...part, elements: part.elements.map(e => ({ ...e, shape: { ...e.shape as any }, transform: { ...e.transform } })) }
    if (selectedElement >= currentPart.elements.length) selectedElement = 0
  }

  $effect(() => {
    const id = getSelectedPartId()
    if (id !== currentId) {
      selectedElement = 0
      loadPart(id)
    }
  })

  function syncCurrentPart() {
    if (!currentId) return
    const part = getProject().partMap[currentId]
    if (!part) return
    currentPart = { ...part, elements: part.elements.map(e => ({ ...e, shape: { ...e.shape as any }, transform: { ...e.transform } })) }
  }

  function handleNameChange(e: Event) {
    if (!currentId) return
    const val = (e.target as HTMLInputElement).value
    updatePart(currentId, { name: val })
    if (currentPart) currentPart.name = val
  }

  function handlePosChange() {
    if (!currentId || !currentPart) return
    updateTransform(currentId, { position: [...currentPart.transform.position] as [number, number, number] })
  }

  function handleRotChange() {
    if (!currentId || !currentPart) return
    updateTransform(currentId, { rotation: [...currentPart.transform.rotation] as [number, number, number] })
  }

  function handlePivotChange() {
    if (!currentId || !currentPart) return
    updateTransform(currentId, { pivot: [...currentPart.transform.pivot] as [number, number, number] })
  }

  function handleScale() {
    if (!currentId) return
    const el = document.getElementById('prop-scale') as HTMLInputElement
    const factor = parseFloat(el.value)
    if (isNaN(factor) || factor <= 0) return
    rescalePart(currentId, factor)
    el.value = '1'
    syncCurrentPart()
  }

  function handleColorChange(e: Event) {
    if (!currentId) return
    const val = (e.target as HTMLInputElement).value
    updatePart(currentId, { color: val })
    if (currentPart) currentPart.color = val
  }

  function handleDelete() {
    if (!currentId) return
    const id = currentId
    selectPart(null)
    removePart(id)
    currentId = null
    currentPart = null
  }

  function handleElemParamChange(key: string, e: Event) {
    if (!currentId || !currentPart) return
    const val = parseFloat((e.target as HTMLInputElement).value)
    if (isNaN(val)) return
    updateElementParam(currentId, selectedElement, key, val)
    const elem = currentPart.elements[selectedElement]
    if (elem) (elem.shape as any)[key] = val
  }

  function handleElemTypeChange(e: Event) {
    if (!currentId || !currentPart) return
    const type = (e.target as HTMLSelectElement).value as ShapeType
    const defaults = getDefaultParams(type)
    snapshot()
    const part = getProject().partMap[currentId]
    if (!part) return
    const elem = part.elements[selectedElement]
    if (!elem) return
    Object.assign(elem.shape, defaults)
    syncCurrentPart()
  }

  function handleElemPosChange() {
    if (!currentId || !currentPart) return
    const elem = currentPart.elements[selectedElement]
    if (!elem) return
    updateElementTransform(currentId, selectedElement, { position: [...elem.transform.position] as [number, number, number] })
  }

  function handleElemRotChange() {
    if (!currentId || !currentPart) return
    const elem = currentPart.elements[selectedElement]
    if (!elem) return
    updateElementTransform(currentId, selectedElement, { rotation: [...elem.transform.rotation] as [number, number, number] })
  }

  function handleElemPivotChange() {
    if (!currentId || !currentPart) return
    const elem = currentPart.elements[selectedElement]
    if (!elem) return
    updateElementTransform(currentId, selectedElement, { pivot: [...elem.transform.pivot] as [number, number, number] })
  }

  function handleAddElement() {
    if (!currentId) return
    addElement(currentId, 'box')
    const part = getProject().partMap[currentId]
    if (part) {
      selectedElement = part.elements.length - 1
      syncCurrentPart()
    }
  }

  function handleRemoveElement() {
    if (!currentId) return
    const part = getProject().partMap[currentId]
    if (!part || part.elements.length <= 1) return
    removeElement(currentId, selectedElement)
    if (selectedElement >= part.elements.length - 1) selectedElement = Math.max(0, part.elements.length - 2)
    syncCurrentPart()
  }

  const element = $derived(currentPart?.elements[selectedElement] ?? null)
  const paramList = $derived(element ? getParamList(element.shape) : [])
  const elementCount = $derived(currentPart?.elements.length ?? 0)

  const modeLabel = $derived.by(() => {
    const m = getSelectionMode()
    if (m === 'face') return 'Face'
    if (m === 'scale') return 'Scale'
    return 'Object'
  })

  function toggleSection(id: string) {
    const next = new Set(collapsedSections)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsedSections = next
  }

  function isCollapsed(id: string): boolean {
    return collapsedSections.has(id)
  }
</script>

<div class="properties">
  <h3 class="panel-title">プロパティ <span class="mode-badge">{modeLabel}</span></h3>

  {#if currentPart}
    <div class="prop-group">
      <label for="prop-name" class="prop-label">名前</label>
      <input id="prop-name" type="text" value={currentPart.name} oninput={handleNameChange} />
    </div>

    {#if elementCount > 0}
      <div class="elem-tabs">
        {#each Array(elementCount) as _, i}
          <button
            class="elem-tab"
            class:active={selectedElement === i}
            onclick={() => { selectedElement = i }}
          >要素{i + 1}</button>
        {/each}
        <button class="elem-tab add" onclick={handleAddElement} title="要素追加">＋</button>
        <button class="elem-tab remove" onclick={handleRemoveElement} title="要素削除" disabled={elementCount <= 1}>－</button>
      </div>

      {#if element}
        <div class="elem-section">
          <h4 class="section-title">形状タイプ</h4>
          <div class="prop-group">
            <select value={element.shape.type} onchange={handleElemTypeChange} class="elem-type-select">
              {#each shapeTypes as st}
                <option value={st}>{getShapeName(st)}</option>
              {/each}
            </select>
          </div>

          <h4 class="section-title">形状パラメータ</h4>
          {#each paramList as param}
            <div class="prop-group">
              <label for="elem-prop-{selectedElement}-{param.key}" class="prop-label">{param.label}</label>
              <input
                id="elem-prop-{selectedElement}-{param.key}"
                type="number"
                value={(element.shape as any)[param.key] ?? ''}
                onchange={(e) => handleElemParamChange(param.key, e)}
                step={param.step ?? 0.5}
                min={param.min ?? 0}
              />
            </div>
          {/each}

          <button class="section-toggle" onclick={() => toggleSection('elemOffset')}>
            <span class="section-title clickable">要素オフセット {isCollapsed('elemOffset') ? '▶' : '▼'}</span>
          </button>
          {#if !isCollapsed('elemOffset')}
            <div class="prop-row">
              <div class="prop-group small">
                <label for="elem-pos-x-{selectedElement}" class="prop-label">X</label>
                <input id="elem-pos-x-{selectedElement}" type="number" value={element.transform.position[0]} onchange={handleElemPosChange} step="0.5" />
              </div>
              <div class="prop-group small">
                <label for="elem-pos-y-{selectedElement}" class="prop-label">Y</label>
                <input id="elem-pos-y-{selectedElement}" type="number" value={element.transform.position[1]} onchange={handleElemPosChange} step="0.5" />
              </div>
              <div class="prop-group small">
                <label for="elem-pos-z-{selectedElement}" class="prop-label">Z</label>
                <input id="elem-pos-z-{selectedElement}" type="number" value={element.transform.position[2]} onchange={handleElemPosChange} step="0.5" />
              </div>
            </div>
          {/if}

          <button class="section-toggle" onclick={() => toggleSection('elemRot')}>
            <span class="section-title clickable">要素回転 {isCollapsed('elemRot') ? '▶' : '▼'}</span>
          </button>
          {#if !isCollapsed('elemRot')}
            <div class="prop-row">
              <div class="prop-group small">
                <label for="elem-rot-x-{selectedElement}" class="prop-label">X</label>
                <input id="elem-rot-x-{selectedElement}" type="number" value={element.transform.rotation[0]} onchange={handleElemRotChange} step="22.5" />
              </div>
              <div class="prop-group small">
                <label for="elem-rot-y-{selectedElement}" class="prop-label">Y</label>
                <input id="elem-rot-y-{selectedElement}" type="number" value={element.transform.rotation[1]} onchange={handleElemRotChange} step="22.5" />
              </div>
              <div class="prop-group small">
                <label for="elem-rot-z-{selectedElement}" class="prop-label">Z</label>
                <input id="elem-rot-z-{selectedElement}" type="number" value={element.transform.rotation[2]} onchange={handleElemRotChange} step="22.5" />
              </div>
            </div>
          {/if}

          <button class="section-toggle" onclick={() => toggleSection('elemPivot')}>
            <span class="section-title clickable">要素Pivot {isCollapsed('elemPivot') ? '▶' : '▼'}</span>
          </button>
          {#if !isCollapsed('elemPivot')}
            <div class="prop-row">
              <div class="prop-group small">
                <label for="elem-pivot-x-{selectedElement}" class="prop-label">X</label>
                <input id="elem-pivot-x-{selectedElement}" type="number" value={element.transform.pivot[0]} onchange={handleElemPivotChange} step="0.5" />
              </div>
              <div class="prop-group small">
                <label for="elem-pivot-y-{selectedElement}" class="prop-label">Y</label>
                <input id="elem-pivot-y-{selectedElement}" type="number" value={element.transform.pivot[1]} onchange={handleElemPivotChange} step="0.5" />
              </div>
              <div class="prop-group small">
                <label for="elem-pivot-z-{selectedElement}" class="prop-label">Z</label>
                <input id="elem-pivot-z-{selectedElement}" type="number" value={element.transform.pivot[2]} onchange={handleElemPivotChange} step="0.5" />
              </div>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <button class="section-toggle" onclick={() => toggleSection('worldPos')}>
      <span class="section-title clickable">パーツ位置（ワールド） {isCollapsed('worldPos') ? '▶' : '▼'}</span>
    </button>
    {#if !isCollapsed('worldPos')}
      <div class="prop-row">
        <div class="prop-group small">
          <label for="prop-pos-x" class="prop-label">X</label>
          <input id="prop-pos-x" type="number" value={currentPart.transform.position[0]} onchange={handlePosChange} step="1" />
        </div>
        <div class="prop-group small">
          <label for="prop-pos-y" class="prop-label">Y</label>
          <input id="prop-pos-y" type="number" value={currentPart.transform.position[1]} onchange={handlePosChange} step="1" />
        </div>
        <div class="prop-group small">
          <label for="prop-pos-z" class="prop-label">Z</label>
          <input id="prop-pos-z" type="number" value={currentPart.transform.position[2]} onchange={handlePosChange} step="1" />
        </div>
      </div>
    {/if}

    <button class="section-toggle" onclick={() => toggleSection('rot')}>
      <span class="section-title clickable">回転 {isCollapsed('rot') ? '▶' : '▼'}</span>
    </button>
    {#if !isCollapsed('rot')}
      <div class="prop-row">
        <div class="prop-group small">
          <label for="prop-rot-x" class="prop-label">X</label>
          <input id="prop-rot-x" type="number" value={currentPart.transform.rotation[0]} onchange={handleRotChange} step="22.5" />
        </div>
        <div class="prop-group small">
          <label for="prop-rot-y" class="prop-label">Y</label>
          <input id="prop-rot-y" type="number" value={currentPart.transform.rotation[1]} onchange={handleRotChange} step="22.5" />
        </div>
        <div class="prop-group small">
          <label for="prop-rot-z" class="prop-label">Z</label>
          <input id="prop-rot-z" type="number" value={currentPart.transform.rotation[2]} onchange={handleRotChange} step="22.5" />
        </div>
      </div>
    {/if}

    <button class="section-toggle" onclick={() => toggleSection('pivot')}>
      <span class="section-title clickable">Pivot {isCollapsed('pivot') ? '▶' : '▼'}</span>
    </button>
    {#if !isCollapsed('pivot')}
      <div class="prop-row">
        <div class="prop-group small">
          <label for="prop-pivot-x" class="prop-label">X</label>
          <input id="prop-pivot-x" type="number" value={currentPart.transform.pivot[0]} onchange={handlePivotChange} step="0.5" />
        </div>
        <div class="prop-group small">
          <label for="prop-pivot-y" class="prop-label">Y</label>
          <input id="prop-pivot-y" type="number" value={currentPart.transform.pivot[1]} onchange={handlePivotChange} step="0.5" />
        </div>
        <div class="prop-group small">
          <label for="prop-pivot-z" class="prop-label">Z</label>
          <input id="prop-pivot-z" type="number" value={currentPart.transform.pivot[2]} onchange={handlePivotChange} step="0.5" />
        </div>
      </div>
    {/if}

    <h4 class="section-title">色</h4>
    <div class="prop-group">
      <input id="prop-color" type="color" value={currentPart.color} onchange={handleColorChange} style="width: 100%; height: 32px; padding: 2px;" />
    </div>

    <button class="section-toggle" onclick={() => toggleSection('scale')}>
      <span class="section-title clickable">スケール {isCollapsed('scale') ? '▶' : '▼'}</span>
    </button>
    {#if !isCollapsed('scale')}
      <div class="prop-row">
        <div class="prop-group small">
          <label for="prop-scale" class="prop-label">倍率</label>
          <input id="prop-scale" type="number" value={1} step="0.1" min="0.1" />
        </div>
        <div class="prop-group small" style="display: flex; align-items: flex-end;">
          <button class="scale-btn" onclick={handleScale}>適用</button>
        </div>
      </div>
    {/if}

    <div class="prop-actions">
      <button class="delete-btn" onclick={handleDelete}>削除</button>
    </div>
  {:else}
    <div class="no-selection">
      <p>パーツを選択してください</p>
    </div>
  {/if}
</div>

<style>
  .properties { padding: 12px; border-bottom: 1px solid var(--border); }
  .panel-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
  .mode-badge { display: inline-block; background: var(--accent); color: white; font-size: 10px; padding: 1px 6px; border-radius: 3px; margin-left: 6px; text-transform: none; letter-spacing: 0; }
  .section-title { font-size: 11px; font-weight: 500; color: var(--text-secondary); margin: 8px 0 4px; }
  .prop-group { margin-bottom: 6px; }
  .prop-group.small { flex: 1; min-width: 0; }
  .prop-row { display: flex; gap: 4px; }
  .prop-label { display: block; font-size: 10px; color: var(--text-secondary); margin-bottom: 2px; }
  .prop-group input, .elem-type-select { width: 100%; padding: 4px 6px; font-size: 12px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px; box-sizing: border-box; }
  .no-selection { padding: 24px 8px; text-align: center; color: var(--text-secondary); font-size: 12px; }
  .no-selection p { margin: 0; }
  .elem-tabs { display: flex; gap: 4px; margin: 8px 0; flex-wrap: wrap; }
  .elem-tab { padding: 3px 8px; font-size: 11px; border-radius: 4px; background: var(--bg-surface); border: 1px solid var(--border); color: var(--text-primary); cursor: pointer; transition: all 0.15s; }
  .elem-tab.active { background: var(--accent); color: white; border-color: var(--accent); }
  .elem-tab.add, .elem-tab.remove { font-weight: bold; min-width: 24px; text-align: center; }
  .elem-tab:disabled { opacity: 0.4; cursor: default; }
  .elem-section { border: 1px solid var(--border); border-radius: 4px; padding: 8px; margin-bottom: 8px; background: rgba(255,255,255,0.02); }
  .prop-actions { margin-top: 12px; }
  .delete-btn { width: 100%; padding: 6px; background: var(--accent); color: white; border-radius: 4px; font-size: 12px; transition: background 0.15s; cursor: pointer; border: none; }
  .delete-btn:hover { background: var(--accent-hover); }
  .scale-btn { width: 100%; padding: 4px 10px; background: var(--accent); color: white; border-radius: 4px; font-size: 11px; cursor: pointer; border: none; height: 26px; }
  .scale-btn:hover { background: var(--accent-hover); }

  .section-toggle {
    display: block;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    margin: 8px 0 4px;
    cursor: pointer;
    text-align: left;
  }

  .section-title.clickable {
    margin: 0;
    cursor: pointer;
    user-select: none;
  }

  .section-title.clickable:hover {
    color: var(--text-primary);
  }
</style>
