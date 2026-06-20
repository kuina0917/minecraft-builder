import * as THREE from 'three'
import type { Part } from '../types'

export interface FaceHit {
  partId: string
  point: THREE.Vector3
  normal: THREE.Vector3
}

export class SelectionManager {
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private selectedObjects = new Map<string, { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }>()
  private mergedMeshes = new Map<string, { group: THREE.Group; meshes: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[]; wasVisible: boolean }>()
  private highlightMaterial = new THREE.MeshStandardMaterial({
    color: 0x44aaff,
    emissive: 0x2244aa,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.8,
  })

  private collectMeshes(scene: THREE.Scene): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.partId) {
        meshes.push(obj)
      }
    })
    return meshes
  }

  select(
    event: PointerEvent,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    addToSelection = false
  ): string | null {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.pointer, camera)
    const meshes = this.collectMeshes(scene)
    const intersects = this.raycaster.intersectObjects(meshes, false)

    if (!addToSelection) {
      this.clearHighlight()
    }

    if (intersects.length > 0) {
      const hit = intersects[0].object
      if (hit instanceof THREE.Mesh && hit.userData.partId) {
        const pid = hit.userData.partId as string

        if (addToSelection) {
          if (this.selectedObjects.has(pid)) {
            this.unhighlight(pid)
            return pid
          }
        }

        this.highlight(hit)
        return pid
      }
    }

    return null
  }

  highlight(mesh: THREE.Mesh): void {
    const partId = mesh.userData.partId as string
    if (!partId) return
    if (this.selectedObjects.has(partId)) return

    if (!Array.isArray(mesh.material)) {
      this.selectedObjects.set(partId, { mesh, material: mesh.material })
      mesh.material = this.highlightMaterial.clone()
    }
  }

  highlightByPartId(partId: string, scene: THREE.Scene): void {
    if (this.selectedObjects.has(partId)) return
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.partId === partId) {
        this.highlight(obj)
      }
    })
  }

  highlightMerged(selectedPartId: string, partMap: Record<string, Part>, scene: THREE.Scene): void {
    const part = partMap[selectedPartId]
    if (!part || !part.mergedPartIds) return

    for (const mid of part.mergedPartIds) {
      if (this.mergedMeshes.has(mid)) continue
      scene.traverse((obj) => {
        if (obj instanceof THREE.Group && obj.userData.partId === mid) {
          const wasVisible = obj.visible
          obj.visible = true
          const meshes: THREE.Mesh[] = []
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              meshes.push(child)
            }
          })
          const entries: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = []
          for (const m of meshes) {
            if (!Array.isArray(m.material)) {
              entries.push({ mesh: m, material: m.material })
              m.material = this.highlightMaterial.clone()
            }
          }
          this.mergedMeshes.set(mid, { group: obj, meshes: entries, wasVisible })
        }
      })
    }
  }

  clearMergedHighlight(): void {
    for (const [, entry] of this.mergedMeshes) {
      for (const me of entry.meshes) {
        me.mesh.material = me.material
      }
      entry.group.visible = entry.wasVisible
    }
    this.mergedMeshes.clear()
  }

  highlightCombined(selectedPartId: string, partMap: Record<string, Part>, scene: THREE.Scene): void {
    const part = partMap[selectedPartId]
    if (!part) return

    this.highlightMerged(selectedPartId, partMap, scene)
  }

  unhighlight(partId: string): void {
    const entry = this.selectedObjects.get(partId)
    if (!entry) return
    entry.mesh.material = entry.material
    this.selectedObjects.delete(partId)
  }

  raycastFace(
    event: PointerEvent,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene
  ): FaceHit | null {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.pointer, camera)
    const meshes = this.collectMeshes(scene)
    const intersects = this.raycaster.intersectObjects(meshes, false)

    if (intersects.length > 0) {
      const hit = intersects[0]
      if (hit.object instanceof THREE.Mesh && hit.object.userData.partId && hit.face) {
        return {
          partId: hit.object.userData.partId as string,
          point: hit.point.clone(),
          normal: hit.face.normal.clone(),
        }
      }
    }
    return null
  }

  clearHighlight(): void {
    for (const [, entry] of this.selectedObjects) {
      entry.mesh.material = entry.material
    }
    this.selectedObjects.clear()
    this.clearMergedHighlight()
  }

  isHighlighted(partId: string): boolean {
    return this.selectedObjects.has(partId)
  }

  getSelectedPartIds(): string[] {
    return Array.from(this.selectedObjects.keys())
  }

  dispose(): void {
    this.clearHighlight()
  }
}
