import type { Part, ShapeType, ShapeParams, Project, MeshElement } from '../types'
import { getDefaultParams, getShapeSize } from '../parts/ShapeRegistry'

let project = $state<Project>({
  name: '新規プロジェクト',
  rootParts: [],
  partMap: {},
})

let selectedPartId = $state<string | null>(null)
let selectedPartIds: string[] = $state([])
let nextId = $state(1)
let revision = $state(0)
let wireframeEnabled = $state(false)

const MAX_UNDO = 50
const undoStack: { project: string; nextId: number; selectedPartId: string | null; selectedPartIds: string[] }[] = []

export function undo(): boolean {
  const state = undoStack.pop()
  if (!state) return false
  const restored = JSON.parse(state.project) as Project
  project.name = restored.name
  project.rootParts = restored.rootParts
  project.partMap = restored.partMap
  nextId = state.nextId
  selectedPartId = state.selectedPartId
  selectedPartIds = state.selectedPartIds
  revision++
  return true
}

function generateId(): string {
  return `part_${nextId++}`
}

export function getProject() {
  return project
}

export function getSelectedPartId() {
  return selectedPartId
}

export function getSelectedPartIds() {
  return selectedPartIds
}

export function getRevision() {
  return revision
}

export function bumpRevision(): void {
  revision++
}

export function isWireframeEnabled() {
  return wireframeEnabled
}

export function snapshot(): void {
  undoStack.push({
    project: JSON.stringify(project),
    nextId: nextId,
    selectedPartId: selectedPartId,
    selectedPartIds: [...selectedPartIds],
  })
  if (undoStack.length > MAX_UNDO) undoStack.shift()
}

export function setWireframeEnabled(enabled: boolean) {
  wireframeEnabled = enabled
  revision++
}

export function selectPart(id: string | null) {
  selectedPartId = id
  selectedPartIds = id ? [id] : []
}

export function selectParts(ids: string[]) {
  selectedPartIds = ids
  selectedPartId = ids.length > 0 ? ids[ids.length - 1] : null
}

export function toggleSelectPart(id: string) {
  const idx = selectedPartIds.indexOf(id)
  if (idx >= 0) {
    selectedPartIds = selectedPartIds.filter((pid) => pid !== id)
  } else {
    selectedPartIds = [...selectedPartIds, id]
  }
  selectedPartId = selectedPartIds.length > 0 ? selectedPartIds[selectedPartIds.length - 1] : null
}

export function clearSelection() {
  selectedPartId = null
  selectedPartIds = []
}

export function hasChildren(id: string): boolean {
  return Object.values(project.partMap).some(p => p.parentId === id)
}

function intervalsOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2
}

function isFaceAdjacent(
  pos: [number, number, number],
  size: [number, number, number],
  other: Part
): boolean {
  const [ax, ay, az] = pos
  const [aw, ah, ad] = size
  const [bx, by, bz] = other.transform.position
  const oSize = getShapeSize(other.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })
  const bw = oSize[0], bh = oSize[1], bd = oSize[2]

  if (ax + aw === bx && intervalsOverlap(ay, ay + ah, by, by + bh) && intervalsOverlap(az, az + ad, bz, bz + bd)) return true
  if (bx + bw === ax && intervalsOverlap(ay, ay + ah, by, by + bh) && intervalsOverlap(az, az + ad, bz, bz + bd)) return true
  if (ay + ah === by && intervalsOverlap(ax, ax + aw, bx, bx + bw) && intervalsOverlap(az, az + ad, bz, bz + bd)) return true
  if (by + bh === ay && intervalsOverlap(ax, ax + aw, bx, bx + bw) && intervalsOverlap(az, az + ad, bz, bz + bd)) return true
  if (az + ad === bz && intervalsOverlap(ax, ax + aw, bx, bx + bw) && intervalsOverlap(ay, ay + ah, by, by + bh)) return true
  if (bz + bd === az && intervalsOverlap(ax, ax + aw, bx, bx + bw) && intervalsOverlap(ay, ay + ah, by, by + bh)) return true
  return false
}

export function canPlaceAt(position: [number, number, number]): boolean {
  for (const existing of Object.values(project.partMap)) {
    if (existing.transform.position[0] === position[0] && existing.transform.position[1] === position[1] && existing.transform.position[2] === position[2]) {
      return (existing.elements[0]?.shape?.type ?? 'box') === 'air'
    }
  }
  const remaining = Object.values(project.partMap)
  if (remaining.length > 0) {
    if (position[1] !== 0) {
      return remaining.some((e) => isFaceAdjacent(position, [1, 1, 1], e))
    }
    return true
  }
  return position[1] === 0
}

export function addPart(type: ShapeType, name: string, position: [number, number, number]): Part | null {
  snapshot()

  for (const existing of Object.values(project.partMap)) {
    if (existing.transform.position[0] === position[0] && existing.transform.position[1] === position[1] && existing.transform.position[2] === position[2]) {
      if ((existing.elements[0]?.shape?.type ?? 'box') === 'air') {
        removePart(existing.id)
        break
      }
      return null
    }
  }

  const remaining = Object.values(project.partMap)
  if (remaining.length > 0) {
    if (position[1] !== 0) {
      const valid = remaining.some((e) => isFaceAdjacent(position, [1, 1, 1], e))
      if (!valid) return null
    }
  } else if (position[1] !== 0) {
    return null
  }

  const id = generateId()
  const part: Part = {
    id,
    name,
    elements: [{
      shape: getDefaultParams(type),
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], pivot: [0, 0, 0] },
    }],
    transform: {
      position,
      rotation: [0, 0, 0],
      pivot: [0, 0, 0],
    },
    parentId: null,
    visible: true,
    color: '#e94560',
  }
  project.partMap[id] = part
  project.rootParts.push(id)
  revision++
  return part
}

export function removePart(id: string) {
  snapshot()
  const part = project.partMap[id]
  if (!part) return

  const removeRecursive = (pid: string) => {
    const p = project.partMap[pid]
    if (!p) return
    for (const child of Object.values(project.partMap)) {
      if (child.parentId === pid) removeRecursive(child.id)
    }
    delete project.partMap[pid]
  }

  removeRecursive(id)
  project.rootParts = project.rootParts.filter((pid) => pid !== id)

  if (selectedPartId === id) {
    selectedPartId = null
  }
  selectedPartIds = selectedPartIds.filter((pid) => pid !== id)

  revision++
}

export function updatePart(id: string, updates: Partial<Part>) {
  snapshot()
  const part = project.partMap[id]
  if (!part) return
  Object.assign(part, updates)
  revision++
}

export function updatePartParam(id: string, key: string, value: number) {
  const part = project.partMap[id]
  if (!part || part.elements.length === 0) return
  updateElementParam(id, 0, key, value)
}

export function updateElementParam(id: string, elementIndex: number, key: string, value: number) {
  snapshot()
  const part = project.partMap[id]
  if (!part) return
  const elem = part.elements[elementIndex]
  if (!elem) return
  ;(elem.shape as Record<string, unknown>)[key] = value
  revision++
}

export function updateTransform(id: string, transform: Partial<Part['transform']>) {
  snapshot()
  const part = project.partMap[id]
  if (!part) return
  Object.assign(part.transform, transform)
  revision++
}

export function updateElementTransform(id: string, elementIndex: number, transform: Partial<MeshElement['transform']>) {
  snapshot()
  const part = project.partMap[id]
  if (!part) return
  const elem = part.elements[elementIndex]
  if (!elem) return
  Object.assign(elem.transform, transform)
  revision++
}

export function addElement(id: string, shapeType: ShapeType): boolean {
  snapshot()
  const part = project.partMap[id]
  if (!part) return false
  part.elements.push({
    shape: getDefaultParams(shapeType),
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], pivot: [0, 0, 0] },
  })
  revision++
  return true
}

export function removeElement(id: string, elementIndex: number): boolean {
  snapshot()
  const part = project.partMap[id]
  if (!part || part.elements.length <= 1) return false
  part.elements.splice(elementIndex, 1)
  revision++
  return true
}

export function setProjectName(name: string) {
  snapshot()
  project.name = name
  revision++
}

export function mergeSelected(): string | null {
  snapshot()
  if (selectedPartIds.length < 2) return null

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let name = ''
  let color = '#e94560'

  for (const pid of selectedPartIds) {
    const p = project.partMap[pid]
    if (!p) continue
    if (p.parentId) return null
    const [px, py, pz] = p.transform.position
    const s = getShapeSize(p.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })
    minX = Math.min(minX, px)
    minY = Math.min(minY, py)
    minZ = Math.min(minZ, pz)
    maxX = Math.max(maxX, px + s[0])
    maxY = Math.max(maxY, py + s[1])
    maxZ = Math.max(maxZ, pz + s[2])
    color = p.color
    name = p.name
  }

  if (minX === Infinity) return null

  const groupId = generateId()
  const group: Part = {
    id: groupId,
    name,
    elements: [{ shape: { type: 'box', width: maxX - minX, height: maxY - minY, depth: maxZ - minZ }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], pivot: [0, 0, 0] } }],
    transform: {
      position: [minX, minY, minZ],
      rotation: [0, 0, 0],
      pivot: [0, 0, 0],
    },
    parentId: null,
    visible: true,
    color,
  }
  project.partMap[groupId] = group
  project.rootParts.push(groupId)

  for (const pid of selectedPartIds) {
    const p = project.partMap[pid]
    if (!p) continue
    p.parentId = groupId
  }
  project.rootParts = project.rootParts.filter((r) => !selectedPartIds.includes(r))

  selectedPartId = groupId
  selectedPartIds = [groupId]
  revision++
  return groupId
}

export function toggleVisibility(id: string): void {
  snapshot()
  const part = project.partMap[id]
  if (!part) return
  part.visible = !part.visible
  // Also toggle children visibility (for old group-like behavior)
  for (const child of Object.values(project.partMap)) {
    if (child.parentId === id) child.visible = part.visible
  }
  revision++
}

export function ungroupSelected(): boolean {
  snapshot()
  if (selectedPartIds.length !== 1) return false
  const group = project.partMap[selectedPartIds[0]]
  if (!group) return false
  if (!Object.values(project.partMap).some(p => p.parentId === group.id)) return false

  const children = Object.values(project.partMap).filter((p) => p.parentId === group.id)
  for (const child of children) {
    child.parentId = null
    project.rootParts.push(child.id)
  }
  delete project.partMap[group.id]
  project.rootParts = project.rootParts.filter((pid) => pid !== group.id)

  if (children.length > 0) {
    selectedPartId = children[0].id
    selectedPartIds = [children[0].id]
  } else {
    selectedPartId = null
    selectedPartIds = []
  }
  revision++
  return true
}

export function rescalePart(id: string, factor: number): void {
  snapshot()
  const part = project.partMap[id]
  if (!part || factor <= 0) return

  const scaleParams = (shape: ShapeParams): void => {
    const dimKeys: Record<string, string[]> = {
      box: ['width', 'height', 'depth'],
      radial: ['height', 'topRadius', 'bottomRadius'],
      sphere: ['radius'],
      wedge: ['width', 'height', 'depth'],
      ring: ['outerRadius', 'innerRadius', 'height'],
      pipe: ['outerRadius', 'innerRadius', 'height'],
    }
    const keys = dimKeys[shape.type]
    if (!keys) return
    for (const key of keys) {
      ;(shape as Record<string, unknown>)[key] = Math.round(((shape as Record<string, number>)[key] * factor) * 10) / 10
    }
  }

  for (const elem of part.elements) {
    scaleParams(elem.shape)
    elem.transform.position = [
      Math.round(elem.transform.position[0] * factor * 10) / 10,
      Math.round(elem.transform.position[1] * factor * 10) / 10,
      Math.round(elem.transform.position[2] * factor * 10) / 10,
    ]
  }
  revision++
}

export function splitSelected(): string[] {
  snapshot()
  const id = selectedPartId
  if (!id) return []
  const part = project.partMap[id]
  if (!part) return []

  const [px, py, pz] = part.transform.position
  const s = getShapeSize(part.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })
  const sw = Math.ceil(s[0]), sh = Math.ceil(s[1]), sd = Math.ceil(s[2])

  delete project.partMap[id]
  project.rootParts = project.rootParts.filter((pid) => pid !== id)

  const newIds: string[] = []
  for (let x = 0; x < sw; x++) {
    for (let y = 0; y < sh; y++) {
      for (let z = 0; z < sd; z++) {
        const childId = generateId()
        const child: Part = {
          id: childId,
          name: `${part.name}_${x}_${y}_${z}`,
          elements: [{ shape: { type: 'box', width: 1, height: 1, depth: 1 }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], pivot: [0, 0, 0] } }],
          transform: {
            position: [px + x, py + y, pz + z],
            rotation: [0, 0, 0],
            pivot: [0, 0, 0],
          },
          parentId: null,
          visible: true,
          color: part.color,
        }
        project.partMap[childId] = child
        project.rootParts.push(childId)
        newIds.push(childId)
      }
    }
  }

  if (newIds.length > 0) {
    selectedPartId = newIds[0]
    selectedPartIds = newIds
  } else {
    selectedPartId = null
    selectedPartIds = []
  }

  revision++
  return newIds
}

export function booleanAdd(sourceId: string, targetId: string): string | null {
  snapshot()
  const source = project.partMap[sourceId]
  const target = project.partMap[targetId]
  if (!source || !target) return null

  const relX = target.transform.position[0] - source.transform.position[0]
  const relY = target.transform.position[1] - source.transform.position[1]
  const relZ = target.transform.position[2] - source.transform.position[2]

  for (const el of target.elements) {
    const newEl = {
      shape: { ...el.shape },
      transform: {
        position: [
          el.transform.position[0] + relX,
          el.transform.position[1] + relY,
          el.transform.position[2] + relZ,
        ] as [number, number, number],
        rotation: [...el.transform.rotation] as [number, number, number],
        pivot: [...el.transform.pivot] as [number, number, number],
      }
    }
    source.elements.push(newEl as any)
  }

  source.name = `${source.name}+${target.name}`

  if (!source.mergedPartIds) source.mergedPartIds = []
  if (!source.mergedPartIds.includes(targetId)) source.mergedPartIds.push(targetId)

  target.mergedInto = sourceId
  target.visible = false
  project.rootParts = project.rootParts.filter((pid) => pid !== targetId)

  selectedPartId = sourceId
  selectedPartIds = [sourceId]
  revision++
  return sourceId
}

export function booleanSubtract(sourceId: string, targetId: string): string | null {
  snapshot()
  const source = project.partMap[sourceId]
  const target = project.partMap[targetId]
  if (!source || !target) return null

  source.name = `${source.name}-${target.name}`

  delete project.partMap[targetId]
  project.rootParts = project.rootParts.filter((pid) => pid !== targetId)

  selectedPartId = sourceId
  selectedPartIds = [sourceId]
  revision++
  return sourceId
}

export function booleanIntersect(sourceId: string, targetId: string): string | null {
  snapshot()
  const source = project.partMap[sourceId]
  const target = project.partMap[targetId]
  if (!source || !target) return null

  const sSize = getShapeSize(source.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })
  const tSize = getShapeSize(target.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })

  const minX = Math.max(source.transform.position[0], target.transform.position[0])
  const minY = Math.max(source.transform.position[1], target.transform.position[1])
  const minZ = Math.max(source.transform.position[2], target.transform.position[2])
  const maxX = Math.min(source.transform.position[0] + sSize[0], target.transform.position[0] + tSize[0])
  const maxY = Math.min(source.transform.position[1] + sSize[1], target.transform.position[1] + tSize[1])
  const maxZ = Math.min(source.transform.position[2] + sSize[2], target.transform.position[2] + tSize[2])

  if (maxX <= minX || maxY <= minY || maxZ <= minZ) {
    revision++
    return null
  }

  const resultId = generateId()
  const result: Part = {
    id: resultId,
    name: `${source.name}&${target.name}`,
    elements: [{ shape: { type: 'box', width: maxX - minX, height: maxY - minY, depth: maxZ - minZ }, transform: { position: [0, 0, 0], rotation: [0, 0, 0], pivot: [0, 0, 0] } }],
    transform: {
      position: [minX, minY, minZ],
      rotation: [0, 0, 0],
      pivot: [0, 0, 0],
    },
    parentId: null,
    visible: true,
    color: source.color,
  }
  project.partMap[resultId] = result
  project.rootParts.push(resultId)

  delete project.partMap[sourceId]
  delete project.partMap[targetId]
  project.rootParts = project.rootParts.filter((pid) => pid !== sourceId && pid !== targetId)

  selectedPartId = resultId
  selectedPartIds = [resultId]
  revision++
  return resultId
}
