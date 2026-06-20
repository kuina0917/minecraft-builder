import * as THREE from 'three'
import type { Part, ShapeParams } from '../types'
import { generateGeometry } from './GeometryGenerator'
import { getShapeSize } from './ShapeRegistry'

export function createPartMesh(part: Part): THREE.Group {
  const group = new THREE.Group()

  const [gx, gy, gz] = part.transform.position
  group.position.set(gx, gy, gz)
  group.userData.partId = part.id

  part.elements.forEach((elem, i) => {
    const geometry = generateGeometry(elem.shape)
    const material = new THREE.MeshStandardMaterial({
      color: part.color,
      roughness: 0.6,
      metalness: 0.1,
    })

    const mesh = new THREE.Mesh(geometry, material)
    const [ex, ey, ez] = elem.transform.position
    const size = getShapeSize(elem.shape)
    mesh.position.set(ex + size[0] / 2, ey + size[1] / 2, ez + size[2] / 2)
    mesh.userData.partId = part.id
    mesh.userData.elementIndex = i
    mesh.castShadow = true
    mesh.receiveShadow = true

    group.add(mesh)
  })

  return group
}

export function createGhostMesh(shapeType: string, size: [number, number, number]): THREE.Object3D {
  const ghostShape: ShapeParams = shapeType === 'air'
    ? { type: 'air' }
    : shapeType === 'radial'
      ? { type: 'radial', height: size[1], topRadius: size[0] / 2, bottomRadius: size[0] / 2, segments: 16 }
      : shapeType === 'sphere'
        ? { type: 'sphere', radius: size[0] / 2, segments: 16 }
        : shapeType === 'wedge'
          ? { type: 'wedge', width: size[0], height: size[1], depth: size[2] }
          : shapeType === 'ring'
            ? { type: 'ring', outerRadius: size[0] / 2, innerRadius: Math.max(size[0] / 4, 0.25), height: size[1], segments: 24 }
            : shapeType === 'pipe'
              ? { type: 'pipe', outerRadius: size[0] / 2, innerRadius: Math.max(size[0] / 4, 0.25), height: size[1], segments: 16 }
              : { type: 'box', width: size[0], height: size[1], depth: size[2] }

  if (shapeType === 'air') {
    const geometry = new THREE.BoxGeometry(size[0], size[1], size[2])
    const edges = new THREE.EdgesGeometry(geometry)
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x88aadd, transparent: true, opacity: 0.5 })
    const mesh = new THREE.LineSegments(edges, edgeMat)
    mesh.userData.isGhost = true
    mesh.userData.ghostSize = size
    return mesh
  }

  const geometry = generateGeometry(ghostShape)
  const material = new THREE.MeshBasicMaterial({
    color: 0x44aaff,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.userData.isGhost = true
  mesh.userData.ghostSize = size
  return mesh
}
