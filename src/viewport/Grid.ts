import * as THREE from 'three'

export function createMinecraftGrid(size: number = 50, divisions: number = 50): THREE.Group {
  const group = new THREE.Group()
  const material = new THREE.LineBasicMaterial({ color: 0x444466, transparent: true, opacity: 0.5 })
  const strongMaterial = new THREE.LineBasicMaterial({ color: 0x8888aa, transparent: true, opacity: 0.8 })
  const half = size / 2
  const step = size / divisions

  for (let i = 0; i <= divisions; i++) {
    const isMain = i % 10 === 0
    const mat = isMain ? strongMaterial : material
    const pos = -half + i * step

    const xGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-half, 0, pos),
      new THREE.Vector3(half, 0, pos)
    ])
    group.add(new THREE.Line(xGeom, mat))

    const zGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(pos, 0, -half),
      new THREE.Vector3(pos, 0, half)
    ])
    group.add(new THREE.Line(zGeom, mat))
  }

  return group
}
