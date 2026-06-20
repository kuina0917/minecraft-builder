import type { Project, Part } from '../types'
import { getShapeSize } from '../parts/ShapeRegistry'

interface BBModel {
  meta: {
    format_version: string
    creation_time: string
    model_format: string
  }
  name: string
  model_identifier: string
  visible_bounds: [number, number, number]
  visible_bounds_offset: [number, number, number]
  texture_size: [number, number]
  textures: Array<{
    name: string
    source: string
    path: string
  }>
  elements: Array<Record<string, unknown>>
  outliner: Array<string | string[]>
  groups: Array<{
    name: string
    origin: [number, number, number]
    color: number
    uuid: string
    export: boolean
    visibility: boolean
  }>
  node_map: Record<string, string>
}

let uuidCounter = 0
function generateUUID(): string {
  return `part-${uuidCounter++}`
}

function partToBoxElement(part: Part): Record<string, unknown> {
  const size = getShapeSize(part.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })
  const [w, h, d] = size
  const [px, py, pz] = part.transform.position
  const [rx, ry, rz] = part.transform.rotation

  return {
    name: part.name,
    from: [px, py, pz],
    to: [px + w, py + h, pz + d],
    origin: [px + w / 2, py + h / 2, pz + d / 2],
    rotation: [rx, ry, rz],
    color: parseInt(part.color.slice(1), 16),
    type: 'cube',
    uuid: generateUUID(),
    lock_position: false,
    lock_rotation: false,
    visibility: part.visible,
    export: true,
  }
}

export function exportBBModel(project: Project): string {
  uuidCounter = 0

  const rootParts = project.rootParts.map((id) => project.partMap[id]).filter(Boolean)

  const groups: BBModel['groups'] = []
  const elements: Array<Record<string, unknown>> = []
  const outliner: BBModel['outliner'] = []

  for (const part of rootParts) {
    const elem = partToBoxElement(part)
    elements.push(elem)

    const groupUUID = generateUUID()
    const group: BBModel['groups'][number] = {
      name: part.name,
      origin: [0, 0, 0],
      color: parseInt(part.color.slice(1), 16),
      uuid: groupUUID,
      export: true,
      visibility: true,
    }
    groups.push(group)
    outliner.push([groupUUID])
  }

  const model: BBModel = {
    meta: {
      format_version: '4.4',
      creation_time: new Date().toISOString(),
      model_format: 'free',
    },
    name: project.name,
    model_identifier: '',
    visible_bounds: [20, 20, 20],
    visible_bounds_offset: [0, 0, 0],
    texture_size: [16, 16],
    textures: [
      {
        name: 'texture',
        source: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAABxJREFUOE9jZKAQMFKon4FRA/kHMxrUw0A9AAAFeQHxmcOWTQAAAABJRU5ErkJggg==',
        path: '',
      },
    ],
    elements,
    outliner,
    groups,
    node_map: {},
  }

  return JSON.stringify(model, null, 2)
}
