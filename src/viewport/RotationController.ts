import * as THREE from 'three'
import { getProject, updateTransform } from '../store/projectStore.svelte'
import type { Part } from '../types'
import { getShapeSize } from '../parts/ShapeRegistry'

type RotateAxis = 'x' | 'y' | 'z'

export class RotationController {
  private gizmo: THREE.Group | null = null
  private scene: THREE.Scene | null = null
  private targetPartId: string | null = null
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()

  private activeAxis: RotateAxis | null = null
  private dragStartRotation: [number, number, number] = [0, 0, 0]
  private dragStartAngle = 0
  private pivotWorld = new THREE.Vector3()
  private isDragging = false

  private axisMeshes: Map<RotateAxis, THREE.Group> = new Map()

  show(partId: string, scene: THREE.Scene): void {
    this.hide()
    this.targetPartId = partId
    this.scene = scene

    const part = getProject().partMap[partId]
    if (!part || (part.elements[0]?.shape?.type ?? 'box') === 'air') return

    this.gizmo = new THREE.Group()
    this.gizmo.userData.isGizmo = true

    const [cx, cy, cz] = this.getPivotWorld(part)
    this.pivotWorld.set(cx, cy, cz)
    this.gizmo.position.set(cx, cy, cz)

    const axisColors: Record<RotateAxis, number> = {
      x: 0xff4444,
      y: 0x44ff44,
      z: 0x4444ff,
    }

    for (const axis of ['x', 'y', 'z'] as RotateAxis[]) {
      const mesh = this.createRotationRing(axisColors[axis], axis)
      this.gizmo.add(mesh)
      this.axisMeshes.set(axis, mesh)
    }

    scene.add(this.gizmo)
  }

  private createRotationRing(color: number, axis: RotateAxis): THREE.Group {
    const radius = 2
    const segments = 48
    const ringGeo = new THREE.RingGeometry(radius - 0.06, radius + 0.06, segments)
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(ringGeo, ringMat)
    mesh.userData.rotateAxis = axis
    mesh.userData.isGizmo = true

    // Thin outline for visibility
    const outlinePoints: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2
      outlinePoints.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0))
    }
    const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints)
    const outlineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
    const outline = new THREE.Line(outlineGeo, outlineMat)

    const group = new THREE.Group()
    group.add(mesh)
    group.add(outline)
    group.userData.rotateAxis = axis
    group.userData.isGizmo = true

    switch (axis) {
      case 'x':
        group.rotation.x = Math.PI / 2
        break
      case 'z':
        group.rotation.z = Math.PI / 2
        break
    }

    return group
  }

  private getPivotWorld(part: Part): [number, number, number] {
    const [x, y, z] = part.transform.position
    const size = getShapeSize(part.elements[0]?.shape ?? { type: 'box', width: 1, height: 1, depth: 1 })
    const pivot = part.transform.pivot ?? [0, 0, 0]
    return [x + size[0] / 2 + pivot[0], y + size[1] / 2 + pivot[1], z + size[2] / 2 + pivot[2]]
  }

  hide(): void {
    if (this.gizmo && this.scene) {
      this.scene.remove(this.gizmo)
      this.gizmo = null
    }
    this.axisMeshes.clear()
    this.targetPartId = null
    this.activeAxis = null
    this.isDragging = false
  }

  raycastAxis(event: PointerEvent, camera: THREE.PerspectiveCamera): RotateAxis | null {
    if (!this.gizmo) return null

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)

    const meshes: THREE.Mesh[] = []
    this.gizmo.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.rotateAxis && obj.geometry.type === 'RingGeometry') {
        meshes.push(obj)
      }
    })

    const intersects = this.raycaster.intersectObjects(meshes, false)
    if (intersects.length > 0) {
      let obj: THREE.Object3D = intersects[0].object
      while (obj && !obj.userData.rotateAxis) {
        obj = obj.parent!
      }
      if (obj) return obj.userData.rotateAxis as RotateAxis
    }
    return null
  }

  startDrag(axis: RotateAxis, event: PointerEvent): boolean {
    if (!this.targetPartId) return false
    const part = getProject().partMap[this.targetPartId]
    if (!part) return false

    this.activeAxis = axis
    this.dragStartRotation = [...part.transform.rotation]
    this.dragStartAngle = this.getMouseAngle(event, axis)
    this.isDragging = true
    return true
  }

  private getMouseAngle(event: PointerEvent, _axis: RotateAxis): number {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    const mx = event.clientX - rect.left - rect.width / 2
    const my = event.clientY - rect.top - rect.height / 2
    return Math.atan2(my, mx)
  }

  updateDrag(event: PointerEvent, partMeshes: Map<string, THREE.Object3D>): void {
    if (!this.isDragging || !this.targetPartId || !this.activeAxis) return
    const part = getProject().partMap[this.targetPartId]
    if (!part) return

    const currentAngle = this.getMouseAngle(event, this.activeAxis)
    let angleDelta = currentAngle - this.dragStartAngle
    angleDelta = THREE.MathUtils.radToDeg(angleDelta)
    const snapped = Math.round(angleDelta / 22.5) * 22.5

    const axisMap: Record<RotateAxis, number> = { x: 0, y: 1, z: 2 }
    const idx = axisMap[this.activeAxis]
    const newRotation = [...this.dragStartRotation] as [number, number, number]
    newRotation[idx] = ((this.dragStartRotation[idx] + snapped) % 360 + 360) % 360

    updateTransform(this.targetPartId, { rotation: newRotation })

    const mesh = partMeshes.get(this.targetPartId)
    if (mesh) {
      mesh.rotation.set(
        THREE.MathUtils.degToRad(newRotation[0]),
        THREE.MathUtils.degToRad(newRotation[1]),
        THREE.MathUtils.degToRad(newRotation[2]),
      )
    }
  }

  endDrag(): void {
    this.isDragging = false
    this.activeAxis = null
  }

  isVisible(): boolean {
    return this.gizmo !== null
  }

  getTargetId(): string | null {
    return this.targetPartId
  }

  dispose(): void {
    this.hide()
  }
}
