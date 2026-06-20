import type { ShapeType, ShapeParams, PartDefinition, FaceParamMapping, EdgeParamMapping } from '../types'

export const shapeDefinitions: PartDefinition[] = [
  {
    type: 'box',
    name: 'Box',
    icon: '📦',
    defaultParams: () => ({ type: 'box', width: 1, height: 1, depth: 1 }),
  },
  {
    type: 'radial',
    name: 'Radial',
    icon: '🧴',
    defaultParams: () => ({ type: 'radial', height: 1, topRadius: 0.5, bottomRadius: 0.5, segments: 16 }),
  },
  {
    type: 'sphere',
    name: 'Sphere',
    icon: '⚪',
    defaultParams: () => ({ type: 'sphere', radius: 0.5, segments: 16 }),
  },
  {
    type: 'wedge',
    name: 'Wedge',
    icon: '🔻',
    defaultParams: () => ({ type: 'wedge', width: 1, height: 1, depth: 1 }),
  },
  {
    type: 'ring',
    name: 'Ring',
    icon: '⭕',
    defaultParams: () => ({ type: 'ring', outerRadius: 0.75, innerRadius: 0.25, height: 0.25, segments: 24 }),
  },
  {
    type: 'pipe',
    name: 'Pipe',
    icon: '🔩',
    defaultParams: () => ({ type: 'pipe', outerRadius: 0.5, innerRadius: 0.35, height: 1, segments: 16 }),
  },
  {
    type: 'air',
    name: 'Air',
    icon: '🫧',
    defaultParams: () => ({ type: 'air' }),
  },
]

export type ShapeNameMap = Record<ShapeType, string>
export const shapeNames: ShapeNameMap = {
  box: 'Box',
  radial: 'Radial',
  sphere: 'Sphere',
  wedge: 'Wedge',
  ring: 'Ring',
  pipe: 'Pipe',
  air: 'Air',
}

export function getDefaultParams(type: ShapeType): ShapeParams {
  const def = shapeDefinitions.find(d => d.type === type)
  return def ? def.defaultParams() : { type: 'box', width: 1, height: 1, depth: 1 }
}

export function getParamList(shape: ShapeParams): Array<{ key: string; label: string; min?: number; step?: number }> {
  switch (shape.type) {
    case 'box':
      return [
        { key: 'width', label: '幅', min: 0.1, step: 0.5 },
        { key: 'height', label: '高さ', min: 0.1, step: 0.5 },
        { key: 'depth', label: '奥行', min: 0.1, step: 0.5 },
      ]
    case 'radial':
      return [
        { key: 'height', label: '高さ', min: 0.1, step: 0.5 },
        { key: 'topRadius', label: '上半径', min: 0, step: 0.5 },
        { key: 'bottomRadius', label: '下半径', min: 0, step: 0.5 },
      ]
    case 'sphere':
      return [
        { key: 'radius', label: '半径', min: 0.1, step: 0.5 },
      ]
    case 'wedge':
      return [
        { key: 'width', label: '幅', min: 0.1, step: 0.5 },
        { key: 'height', label: '高さ', min: 0.1, step: 0.5 },
        { key: 'depth', label: '奥行', min: 0.1, step: 0.5 },
      ]
    case 'ring':
      return [
        { key: 'outerRadius', label: '外半径', min: 0.1, step: 0.5 },
        { key: 'innerRadius', label: '内半径', min: 0.01, step: 0.5 },
        { key: 'height', label: '高さ', min: 0.1, step: 0.5 },
      ]
    case 'pipe':
      return [
        { key: 'outerRadius', label: '外半径', min: 0.1, step: 0.5 },
        { key: 'innerRadius', label: '内半径', min: 0.01, step: 0.5 },
        { key: 'height', label: '高さ', min: 0.1, step: 0.5 },
      ]
    default:
      return []
  }
}

// Face -> parameter mapping per shape type.
// When dragging a face, which parameter changes and in which sign?
export function getFaceMapping(shape: ShapeParams, direction: string): FaceParamMapping | null {
  switch (shape.type) {
    case 'box':
      switch (direction) {
        case 'up': return { param: 'height', sign: 1 }
        case 'down': return { param: 'height', sign: 1 }
        case 'right': return { param: 'width', sign: 1 }
        case 'left': return { param: 'width', sign: 1 }
        case 'front': return { param: 'depth', sign: 1 }
        case 'back': return { param: 'depth', sign: 1 }
      }
      break
    case 'radial':
      switch (direction) {
        case 'up': return { param: 'topRadius', sign: 1 }
        case 'down': return { param: 'bottomRadius', sign: 1 }
        case 'front': case 'back': return { param: 'height', sign: 1 }
      }
      break
    case 'wedge':
      switch (direction) {
        case 'up': return { param: 'height', sign: 1 }
        case 'down': return { param: 'height', sign: 1 }
        case 'right': return { param: 'width', sign: 1 }
        case 'left': return { param: 'width', sign: 1 }
        case 'front': return { param: 'depth', sign: 1 }
        case 'back': return { param: 'depth', sign: 1 }
      }
      break
    case 'sphere':
      switch (direction) {
        case 'up': case 'front': case 'right': case 'down': case 'back': case 'left':
          return { param: 'radius', sign: 1 }
      }
      break
    case 'ring':
      switch (direction) {
        case 'up': return { param: 'height', sign: 1 }
        case 'down': return { param: 'height', sign: 1 }
        case 'right': case 'front': case 'left': case 'back': return { param: 'outerRadius', sign: 1 }
      }
      break
    case 'pipe':
      switch (direction) {
        case 'up': return { param: 'height', sign: 1 }
        case 'down': return { param: 'height', sign: 1 }
        case 'right': case 'front': case 'left': case 'back': return { param: 'outerRadius', sign: 1 }
      }
      break
  }
  return null
}

// Edge -> parameter mapping per shape type.
// Edge indices for box (12 edges):
// 0-3: back face (z-min), 4-7: front face (z-max), 8-11: connecting
// For radial: edgeIndex 0 = top circumference, 1 = bottom circumference
export function getEdgeMapping(shape: ShapeParams, edgeIndex: number): EdgeParamMapping | null {
  switch (shape.type) {
    case 'box': {
      // Box edges grouped by the two dimensions they affect:
      // Edges along X axis (width):  edge 0, 2, 4, 6  -> affect height & depth
      // Edges along Y axis (height): edge 1, 3, 5, 7  -> affect width & depth
      // Edges along Z axis (depth):  edge 8, 9, 10, 11 -> affect width & height
      const edgeX = [0, 2, 4, 6]
      const edgeY = [1, 3, 5, 7]
      const edgeZ = [8, 9, 10, 11]
      if (edgeX.includes(edgeIndex)) return { params: [{ name: 'height', delta: 1 }, { name: 'depth', delta: 1 }] }
      if (edgeY.includes(edgeIndex)) return { params: [{ name: 'width', delta: 1 }, { name: 'depth', delta: 1 }] }
      if (edgeZ.includes(edgeIndex)) return { params: [{ name: 'width', delta: 1 }, { name: 'height', delta: 1 }] }
      return null
    }
    case 'radial': {
      if (edgeIndex === 0) return { params: [{ name: 'topRadius', delta: 1 }] }
      if (edgeIndex === 1) return { params: [{ name: 'bottomRadius', delta: 1 }] }
      if (edgeIndex === 2) return { params: [{ name: 'topRadius', delta: 1 }, { name: 'bottomRadius', delta: 1 }] }
      return null
    }
    case 'wedge':
    case 'ring':
    case 'pipe': {
      // Fallback: use face mapping for the edge's adjacent faces
      return { params: [{ name: 'width', delta: 1 }, { name: 'height', delta: 1 }] }
    }
  }
  return null
}

// Get the effective bounding box size from shape params (for position calculations)
export function getShapeSize(shape: ShapeParams): [number, number, number] {
  switch (shape.type) {
    case 'box': return [shape.width, shape.height, shape.depth]
    case 'radial': return [Math.max(shape.topRadius, shape.bottomRadius) * 2, shape.height, Math.max(shape.topRadius, shape.bottomRadius) * 2]
    case 'sphere': return [shape.radius * 2, shape.radius * 2, shape.radius * 2]
    case 'wedge': return [shape.width, shape.height, shape.depth]
    case 'ring': return [shape.outerRadius * 2, shape.height, shape.outerRadius * 2]
    case 'pipe': return [shape.outerRadius * 2, shape.height, shape.outerRadius * 2]
    case 'air': return [1, 1, 1]
  }
}

export function getShapeIcon(type: ShapeType): string {
  const def = shapeDefinitions.find(d => d.type === type)
  return def?.icon ?? '📦'
}

export function getShapeName(type: ShapeType): string {
  const def = shapeDefinitions.find(d => d.type === type)
  return def?.name ?? 'Unknown'
}
