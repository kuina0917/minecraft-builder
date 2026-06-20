export type ShapeType =
  | 'box'
  | 'radial'
  | 'sphere'
  | 'wedge'
  | 'ring'
  | 'pipe'
  | 'air'

export type SelectionMode = 'object' | 'face' | 'scale'

export type FaceDirection = 'up' | 'down' | 'left' | 'right' | 'front' | 'back'

export interface FaceSelection {
  partId: string
  direction: FaceDirection
}

export interface EdgeSelection {
  partId: string
  edgeIndex: number
}

export type BooleanOp = 'add' | 'subtract' | 'intersect'

export interface BooleanOperation {
  type: BooleanOp
  sourceId: string
  targetId: string
}

export interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  pivot: [number, number, number]
}

export interface BoxParams {
  type: 'box'
  width: number
  height: number
  depth: number
}

export interface RadialParams {
  type: 'radial'
  height: number
  topRadius: number
  bottomRadius: number
  segments: number
}

export interface SphereParams {
  type: 'sphere'
  radius: number
  segments: number
}

export interface WedgeParams {
  type: 'wedge'
  width: number
  height: number
  depth: number
}

export interface RingParams {
  type: 'ring'
  outerRadius: number
  innerRadius: number
  height: number
  segments: number
}

export interface PipeParams {
  type: 'pipe'
  outerRadius: number
  innerRadius: number
  height: number
  segments: number
}

export type ShapeParams =
  | BoxParams
  | RadialParams
  | SphereParams
  | WedgeParams
  | RingParams
  | PipeParams
  | { type: 'air' }

export interface MeshElement {
  shape: ShapeParams
  transform: Transform
}

export interface Part {
  id: string
  name: string
  elements: MeshElement[]
  transform: Transform
  parentId: string | null
  visible: boolean
  color: string
}

export interface Project {
  name: string
  rootParts: string[]
  partMap: Record<string, Part>
}

export interface PartDefinition {
  type: ShapeType
  name: string
  icon: string
  defaultParams: () => ShapeParams
}

export interface FaceParamMapping {
  param: string
  sign: 1 | -1
}

export interface EdgeParamDelta {
  name: string
  delta: number
}

export interface EdgeParamMapping {
  params: EdgeParamDelta[]
}
