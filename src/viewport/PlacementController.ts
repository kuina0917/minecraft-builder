import * as THREE from 'three'
import { createGhostMesh } from '../parts/PartFactory'
import type { ShapeType } from '../types'

export class PlacementController {
  active = false
  private partType: ShapeType = 'box'
  private ghost: THREE.Object3D | null = null
  private ghostSize: [number, number, number] = [1, 1, 1]
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private scene: THREE.Scene | null = null
  private onPlace: ((type: ShapeType, position: [number, number, number]) => void) | null = null
  private onCanPlace: ((position: [number, number, number]) => boolean) | null = null
  private tempVec = new THREE.Vector3()
  private _box = new THREE.Box3()

  setCanPlace(fn: (position: [number, number, number]) => boolean): void {
    this.onCanPlace = fn
  }

  start(type: ShapeType, scene: THREE.Scene, callback: (type: ShapeType, position: [number, number, number]) => void): void {
    this.active = true
    this.partType = type
    this.scene = scene
    this.onPlace = callback
    this.ghostSize = [1, 1, 1]
    this.ghost = createGhostMesh(type, this.ghostSize)
    this.ghost.visible = false
    scene.add(this.ghost)
  }

  stop(): void {
    this.active = false
    if (this.ghost && this.scene) {
      this.scene.remove(this.ghost)
      if (this.ghost instanceof THREE.Mesh || this.ghost instanceof THREE.LineSegments) {
        this.ghost.geometry.dispose()
      }
    }
    this.ghost = null
    this.scene = null
    this.onPlace = null
  }

  private getPartMeshes(scene: THREE.Scene): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.partId) {
        meshes.push(obj)
      }
    })
    return meshes
  }

  private pickPart(event: PointerEvent, camera: THREE.PerspectiveCamera, scene: THREE.Scene): { mesh: THREE.Mesh; point: THREE.Vector3; normal: THREE.Vector3 } | null {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)

    const meshes = this.getPartMeshes(scene)
    const intersects = this.raycaster.intersectObjects(meshes, false)
    if (intersects.length > 0) {
      return { mesh: intersects[0].object as THREE.Mesh, point: intersects[0].point, normal: intersects[0].face!.normal.clone() }
    }
    return null
  }

  getSnappedPosition(event: PointerEvent, camera: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3 | null {
    const hit = this.pickPart(event, camera, scene)
    if (hit) {
      this._box.setFromObject(hit.mesh)
      const n = hit.normal.clone().transformDirection(hit.mesh.matrixWorld)
      const abs = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)]
      const axis = abs.indexOf(Math.max(...abs))
      const snapCoord = (ax: number, pt: number) => {
        const min = (ax === 0 ? this._box.min.x : (ax === 1 ? this._box.min.y : this._box.min.z))
        const max = (ax === 0 ? this._box.max.x : (ax === 1 ? this._box.max.y : this._box.max.z))
        return Math.max(min, Math.min(max - 1, Math.round(pt)))
      }
      const pt = hit.point
      const x = axis === 0 ? (n.x > 0 ? this._box.max.x : this._box.min.x - 1) : snapCoord(0, pt.x)
      const y = axis === 1 ? (n.y > 0 ? this._box.max.y : this._box.min.y - 1) : snapCoord(1, pt.y)
      const z = axis === 2 ? (n.z > 0 ? this._box.max.z : this._box.min.z - 1) : snapCoord(2, pt.z)
      return this.tempVec.set(x, y, z)
    }

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)
    const intersection = new THREE.Vector3()
    const result = this.raycaster.ray.intersectPlane(this.groundPlane, intersection)
    if (result) {
      const gx = Math.round(intersection.x)
      const gz = Math.round(intersection.z)
      for (let y = 0; y <= 32; y++) {
        const snapped: [number, number, number] = [gx, y, gz]
        if (!this.onCanPlace || this.onCanPlace(snapped)) {
          return this.tempVec.set(gx, y, gz)
        }
      }
    }
    return null
  }

  updatePreview(event: PointerEvent, camera: THREE.PerspectiveCamera): void {
    if (!this.active || !this.ghost || !this.scene) return

    const pos = this.getSnappedPosition(event, camera, this.scene)
    if (pos) {
      const snapped: [number, number, number] = [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)]
      if (this.onCanPlace && !this.onCanPlace(snapped)) {
        this.ghost.visible = false
        return
      }
      const [w, h, d] = this.ghostSize
      this.ghost.position.set(pos.x + w / 2, pos.y + h / 2, pos.z + d / 2)
      this.ghost.visible = true
    } else {
      this.ghost.visible = false
    }
  }

  updatePreviewAt(pos: THREE.Vector3): void {
    if (!this.active || !this.ghost) return
    const [w, h, d] = this.ghostSize
    this.ghost.position.set(pos.x + w / 2, pos.y + h / 2, pos.z + d / 2)
    this.ghost.visible = true
  }

  tryPlace(event: PointerEvent, camera: THREE.PerspectiveCamera): THREE.Vector3 | null {
    if (!this.active || !this.scene) return null

    const pos = this.getSnappedPosition(event, camera, this.scene)
    if (pos) {
      const snapped: [number, number, number] = [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)]
      this.onPlace?.(this.partType, snapped)
      return pos
    }
    return null
  }

  placeAt(pos: THREE.Vector3): void {
    if (!this.active) return
    const snapped: [number, number, number] = [Math.round(pos.x), Math.round(pos.y), Math.round(pos.z)]
    this.onPlace?.(this.partType, snapped)
  }
}
