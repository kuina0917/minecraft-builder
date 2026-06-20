import * as THREE from 'three'
import type { ShapeParams } from '../types'

export function generateGeometry(shape: ShapeParams): THREE.BufferGeometry {
  switch (shape.type) {
    case 'box':
      return new THREE.BoxGeometry(shape.width, shape.height, shape.depth)
    case 'radial':
      return new THREE.CylinderGeometry(shape.topRadius, shape.bottomRadius, shape.height, shape.segments)
    case 'sphere':
      return new THREE.SphereGeometry(shape.radius, shape.segments, shape.segments)
    case 'wedge':
      return createWedgeGeometry(shape.width, shape.height, shape.depth)
    case 'ring':
      return createRingGeometry(shape.outerRadius, shape.innerRadius, shape.height, shape.segments)
    case 'pipe':
      return createPipeGeometry(shape.outerRadius, shape.innerRadius, shape.height, shape.segments)
    case 'air':
      return new THREE.BoxGeometry(1, 1, 1)
  }
}

export function createGhostGeometry(shape: ShapeParams): THREE.BufferGeometry {
  return generateGeometry(shape)
}

function createWedgeGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-width / 2, -height / 2)
  shape.lineTo(width / 2, -height / 2)
  shape.lineTo(-width / 2, height / 2)
  shape.closePath()

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: depth,
    bevelEnabled: false,
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

function createRingGeometry(outerRadius: number, innerRadius: number, height: number, segments: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const x = Math.cos(theta) * outerRadius
    const y = Math.sin(theta) * outerRadius
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }

  const hole = new THREE.Path()
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const x = Math.cos(theta) * innerRadius
    const y = Math.sin(theta) * innerRadius
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  shape.holes.push(hole)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: height,
    bevelEnabled: false,
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.translate(0, 0, -height / 2)
  return geometry
}

function createPipeGeometry(outerRadius: number, innerRadius: number, height: number, segments: number): THREE.BufferGeometry {
  const shape = new THREE.Shape()

  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const x = Math.cos(theta) * outerRadius
    const y = Math.sin(theta) * outerRadius
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }

  const hole = new THREE.Path()
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const x = Math.cos(theta) * innerRadius
    const y = Math.sin(theta) * innerRadius
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  shape.holes.push(hole)

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    steps: 1,
    depth: height,
    bevelEnabled: false,
  }

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  geometry.translate(0, 0, -height / 2)
  return geometry
}
