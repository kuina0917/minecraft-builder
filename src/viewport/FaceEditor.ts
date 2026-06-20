import * as THREE from 'three'
import type { FaceDirection, ShapeParams, Part } from '../types'
import { generateGeometry } from '../parts/GeometryGenerator'
import { getProject, updateElementParam, updateElementTransform } from '../store/projectStore.svelte'
import { getFaceMapping, getShapeSize } from '../parts/ShapeRegistry'

export interface FaceHitResult {
  partId: string
  elementIndex: number
  direction: FaceDirection
  point: THREE.Vector3
  normal: THREE.Vector3
  mesh: THREE.Mesh
}

export class FaceEditor {
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private selectedPartId: string | null = null
  private selectedElementIndex: number = 0
  private selectedDirection: FaceDirection | null = null
  private highlightMesh: THREE.Mesh | null = null
  private scene: THREE.Scene | null = null

  private isDragging = false
  private dragStartPos = new THREE.Vector3()
  private dragStartParamValue = 0
  private dragPlane = new THREE.Plane()
  private dragStartIntersection = new THREE.Vector3()
  private faceNormal = new THREE.Vector3()
  private faceCenter = new THREE.Vector3()
  private lastSnapped = 0

  onFaceModified: ((partId: string) => void) | null = null

  private collectMeshes(scene: THREE.Scene): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.partId && !obj.userData.isGhost && !obj.userData.isHighlight) {
        meshes.push(obj)
      }
    })
    return meshes
  }

  raycastFace(event: PointerEvent, camera: THREE.PerspectiveCamera, scene: THREE.Scene): FaceHitResult | null {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)

    const meshes = this.collectMeshes(scene)
    const intersects = this.raycaster.intersectObjects(meshes, false)

    if (intersects.length > 0) {
      const hit = intersects[0]
      const mesh = hit.object as THREE.Mesh
      const partId = mesh.userData.partId as string
      if (!partId) return null

      const elementIndex = (mesh.userData.elementIndex as number) ?? 0

      const normal = hit.face!.normal.clone().transformDirection(mesh.matrixWorld)
      const absX = Math.abs(normal.x)
      const absY = Math.abs(normal.y)
      const absZ = Math.abs(normal.z)

      let direction: FaceDirection
      if (absX >= absY && absX >= absZ) {
        direction = normal.x > 0 ? 'right' : 'left'
      } else if (absY >= absX && absY >= absZ) {
        direction = normal.y > 0 ? 'up' : 'down'
      } else {
        direction = normal.z > 0 ? 'front' : 'back'
      }

      return { partId, elementIndex, direction, point: hit.point.clone(), normal, mesh }
    }

    return null
  }

  private elementWorldPos(part: Part): [number, number, number] {
    const elem = part.elements[this.selectedElementIndex]
    if (!elem) return [...part.transform.position]
    const size = getShapeSize(elem.shape)
    return [
      part.transform.position[0] + elem.transform.position[0] + size[0] / 2,
      part.transform.position[1] + elem.transform.position[1] + size[1] / 2,
      part.transform.position[2] + elem.transform.position[2] + size[2] / 2,
    ]
  }

  selectFace(hit: FaceHitResult, scene: THREE.Scene): void {
    this.clearHighlight()
    this.selectedPartId = hit.partId
    this.selectedElementIndex = hit.elementIndex
    this.selectedDirection = hit.direction

    const part = getProject().partMap[hit.partId]
    if (!part) return

    const element = part.elements[hit.elementIndex]
    if (!element) return

    this.scene = scene
    this.highlightMesh = this.createFaceHighlight(element.shape, this.elementWorldPos(part), hit.direction)
    if (this.highlightMesh) {
      scene.add(this.highlightMesh)
    }
  }

  deselect(): void {
    this.clearHighlight()
    this.selectedPartId = null
    this.selectedElementIndex = 0
    this.selectedDirection = null
    this.lastSnapped = 0
  }

  isSelected(partId: string, direction: FaceDirection): boolean {
    return this.selectedPartId === partId && this.selectedDirection === direction
  }

  private getFaceCenter(shape: ShapeParams, position: [number, number, number], direction: FaceDirection): THREE.Vector3 {
    const [x, y, z] = position
    const size = getShapeSize(shape)
    const [w, h, d] = size
    switch (direction) {
      case 'up': return new THREE.Vector3(x, y + h / 2, z)
      case 'down': return new THREE.Vector3(x, y - h / 2, z)
      case 'right': return new THREE.Vector3(x + w / 2, y, z)
      case 'left': return new THREE.Vector3(x - w / 2, y, z)
      case 'front': return new THREE.Vector3(x, y, z + d / 2)
      case 'back': return new THREE.Vector3(x, y, z - d / 2)
    }
  }

  private getFaceNormal(direction: FaceDirection): THREE.Vector3 {
    switch (direction) {
      case 'up': return new THREE.Vector3(0, 1, 0)
      case 'down': return new THREE.Vector3(0, -1, 0)
      case 'right': return new THREE.Vector3(1, 0, 0)
      case 'left': return new THREE.Vector3(-1, 0, 0)
      case 'front': return new THREE.Vector3(0, 0, 1)
      case 'back': return new THREE.Vector3(0, 0, -1)
    }
  }

  private createFaceHighlight(shape: ShapeParams, position: [number, number, number], direction: FaceDirection): THREE.Mesh | null {
    const size = getShapeSize(shape)
    const [w, h, d] = size
    const geom = new THREE.PlaneGeometry(0.9, 0.9)
    const mat = new THREE.MeshBasicMaterial({
      color: 0x44ccff,
      transparent: true,
      opacity: 0.5,
      depthTest: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geom, mat)
    mesh.userData.isHighlight = true
    mesh.raycast = () => {}

    const center = this.getFaceCenter(shape, position, direction)
    mesh.position.copy(center)

    switch (direction) {
      case 'up':
        mesh.lookAt(center.x, center.y + 1, center.z)
        mesh.scale.set(w, d, 1)
        break
      case 'down':
        mesh.lookAt(center.x, center.y - 1, center.z)
        mesh.scale.set(w, d, 1)
        break
      case 'right':
        mesh.lookAt(center.x + 1, center.y, center.z)
        mesh.scale.set(d, h, 1)
        break
      case 'left':
        mesh.lookAt(center.x - 1, center.y, center.z)
        mesh.scale.set(d, h, 1)
        break
      case 'front':
        mesh.lookAt(center.x, center.y, center.z + 1)
        mesh.scale.set(w, h, 1)
        break
      case 'back':
        mesh.lookAt(center.x, center.y, center.z - 1)
        mesh.scale.set(w, h, 1)
        break
    }

    return mesh
  }

  clearHighlight(): void {
    if (this.highlightMesh && this.scene) {
      this.scene.remove(this.highlightMesh)
      this.highlightMesh.geometry.dispose()
      if (Array.isArray(this.highlightMesh.material)) {
        this.highlightMesh.material.forEach((m) => m.dispose())
      } else {
        this.highlightMesh.material.dispose()
      }
      this.highlightMesh = null
    }
  }

  startDrag(event: PointerEvent, camera: THREE.PerspectiveCamera): boolean {
    if (!this.selectedPartId || !this.selectedDirection) return false
    const part = getProject().partMap[this.selectedPartId]
    if (!part) return false

    const element = part.elements[this.selectedElementIndex]
    if (!element) return false

    const mapping = getFaceMapping(element.shape, this.selectedDirection)
    if (!mapping) return false

    this.dragStartPos.set(
      element.transform.position[0],
      element.transform.position[1],
      element.transform.position[2]
    )
    this.dragStartParamValue = (element.shape as Record<string, unknown>)[mapping.param] as number ?? 0

    const worldPos = this.elementWorldPos(part)
    this.faceCenter.copy(this.getFaceCenter(element.shape, worldPos, this.selectedDirection))
    this.faceNormal.copy(this.getFaceNormal(this.selectedDirection))

    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), this.faceCenter)

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartIntersection)) {
      return false
    }

    this.lastSnapped = 0
    this.isDragging = true
    return true
  }

  updateDrag(event: PointerEvent, camera: THREE.PerspectiveCamera, partMeshes: Map<string, THREE.Object3D>): void {
    if (!this.isDragging || !this.selectedPartId || !this.selectedDirection) return
    const part = getProject().partMap[this.selectedPartId]
    if (!part) return

    const elementIndex = this.selectedElementIndex
    const element = part.elements[elementIndex]
    if (!element) return

    const mapping = getFaceMapping(element.shape, this.selectedDirection)
    if (!mapping) return

    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)

    const intersection = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, intersection)) return

    const delta3D = new THREE.Vector3().copy(intersection).sub(this.dragStartIntersection)
    const signedDist = delta3D.dot(this.faceNormal)
    const snapped = Math.round(signedDist * 2) / 2
    if (snapped === 0) return

    if (snapped === this.lastSnapped) return
    this.lastSnapped = snapped

    const newValue = Math.max(0.1, this.dragStartParamValue + snapped)
    updateElementParam(this.selectedPartId, elementIndex, mapping.param, newValue)

    // Shift element position to keep the opposite face fixed.
    // After PartFactory fix, geometry extends from elemPos to elemPos+size.
    // For maximum side (normalSign > 0): min stays fixed → no shift needed.
    // For minimum side (normalSign < 0): max stays fixed → shift by -snapped.
    const newPos: [number, number, number] = [
      this.dragStartPos.x,
      this.dragStartPos.y,
      this.dragStartPos.z,
    ]
    const axis = mapping.param === 'width' ? 0 : mapping.param === 'height' ? 1 : 2
    const normalSign = this.faceNormal.getComponent(axis) > 0 ? 1 : -1
    if (normalSign < 0) {
      newPos[axis] = this.dragStartPos.getComponent(axis) - snapped
      newPos[axis] = Math.round(newPos[axis] * 2) / 2
      updateElementTransform(this.selectedPartId, elementIndex, { position: newPos })
    }

    // Update mesh in scene
    const group = partMeshes.get(this.selectedPartId)
    if (group) {
      const updatedPart = getProject().partMap[this.selectedPartId]
      if (updatedPart) {
        const updatedElement = updatedPart.elements[elementIndex]
        if (updatedElement) {
          const newSize = getShapeSize(updatedElement.shape)
          group.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.elementIndex === elementIndex) {
              child.geometry.dispose()
              child.geometry = generateGeometry(updatedElement.shape)
              child.position.set(
                updatedElement.transform.position[0] + newSize[0] / 2,
                updatedElement.transform.position[1] + newSize[1] / 2,
                updatedElement.transform.position[2] + newSize[2] / 2
              )
            }
          })
        }
      }
    }

    // Update highlight to follow face
    this.clearHighlight()
    if (this.scene) {
      const updatedPart = getProject().partMap[this.selectedPartId]
      if (updatedPart) {
        const updatedElement = updatedPart.elements[elementIndex]
        if (updatedElement) {
          this.highlightMesh = this.createFaceHighlight(updatedElement.shape, this.elementWorldPos(updatedPart), this.selectedDirection)
          if (this.highlightMesh) this.scene.add(this.highlightMesh)
        }
      }
    }
  }

  endDrag(): void {
    this.isDragging = false
    this.lastSnapped = 0
  }

  getSelectedFace(): { partId: string; direction: FaceDirection } | null {
    if (!this.selectedPartId || !this.selectedDirection) return null
    return { partId: this.selectedPartId, direction: this.selectedDirection }
  }

  dispose(): void {
    this.clearHighlight()
  }
}
