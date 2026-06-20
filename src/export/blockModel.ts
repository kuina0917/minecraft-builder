import type { Project } from '../types'
import { getShapeSize } from '../parts/ShapeRegistry'

interface BlockModelElement {
  from: [number, number, number]
  to: [number, number, number]
  rotation?: {
    origin: [number, number, number]
    axis: 'x' | 'y' | 'z'
    angle: number
  }
  faces: Record<string, { uv: [number, number, number, number]; texture: string }>
}

interface BlockModel {
  parent?: string
  ambientocclusion: boolean
  display?: Record<string, unknown>
  textures: Record<string, string>
  elements: BlockModelElement[]
}

export function exportBlockModel(project: Project): string {
  const rootParts = project.rootParts.map((id) => project.partMap[id]).filter(Boolean)

  const elements: BlockModelElement[] = rootParts.map((part) => {
    const size = getShapeSize(part.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })
    const [w, h, d] = size
    const [px, py, pz] = part.transform.position

    const from: [number, number, number] = [px, py, pz]
    const to: [number, number, number] = [px + w, py + h, pz + d]

    const elem: BlockModelElement = {
      from,
      to,
      faces: {
        north: { uv: [0, 0, 16, 16], texture: '#all' },
        south: { uv: [0, 0, 16, 16], texture: '#all' },
        east: { uv: [0, 0, 16, 16], texture: '#all' },
        west: { uv: [0, 0, 16, 16], texture: '#all' },
        up: { uv: [0, 0, 16, 16], texture: '#all' },
        down: { uv: [0, 0, 16, 16], texture: '#all' },
      },
    }

    const rotY = part.transform.rotation[1]

    if (rotY !== 0) {
      elem.rotation = {
        origin: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
        axis: 'y',
        angle: rotY,
      }
    }

    return elem
  })

  const model: BlockModel = {
    ambientocclusion: true,
    textures: {
      particle: '#all',
      all: 'minecraft:block/stone',
    },
    elements,
  }

  return JSON.stringify(model, null, 2)
}
