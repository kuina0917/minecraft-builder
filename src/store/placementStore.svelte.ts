import type { ShapeType, SelectionMode, BooleanOp } from '../types'

let activeType = $state<ShapeType | null>(null)
let stretchMode = $state(false)
let selectionMode = $state<SelectionMode>('object')
let snapUnit = $state(1.0) // 1.0 or 0.5
let booleanOp = $state<BooleanOp | null>(null)
let booleanSourceId = $state<string | null>(null)

export function getPlacementType() {
  return activeType
}

export function setPlacementType(type: ShapeType | null) {
  activeType = type
}

export function getStretchMode() {
  return stretchMode
}

export function setStretchMode(v: boolean) {
  stretchMode = v
}

export function getSnapUnit() {
  return snapUnit
}

export function setSnapUnit(v: number) {
  snapUnit = v
}

export function getSelectionMode() {
  return selectionMode
}

export function setSelectionMode(mode: SelectionMode) {
  selectionMode = mode
  if (mode !== 'object') stretchMode = false
}

export function getBooleanOp() {
  return booleanOp
}

export function setBooleanOp(op: BooleanOp | null) {
  booleanOp = op
}

export function getBooleanSourceId() {
  return booleanSourceId
}

export function setBooleanSourceId(id: string | null) {
  booleanSourceId = id
}
