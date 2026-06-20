import * as THREE from 'three'
import { getProject, updateElementParam, updateElementTransform } from '../store/projectStore.svelte'
import { getEdgeMapping, getShapeSize } from '../parts/ShapeRegistry'
import { generateGeometry } from '../parts/GeometryGenerator'

// Edge metadata: for each edge index, which 2 dimensions change and whether
// the edge is at the minimum of each dimension.
// idx: 0=width/X, 1=height/Y, 2=depth/Z
// isMin: edge at minimum position → elem shifts by -snapped (max face fixed)
//        edge at maximum position → no shift (min face fixed)
const EDGE_META: Array<{ dims: Array<{ idx: number; name: string; isMin: boolean }> }> = [
  { dims: [{ idx: 1, name: 'height', isMin: true }, { idx: 2, name: 'depth', isMin: true }] },  // 0: X, y=0,z=0
  { dims: [{ idx: 0, name: 'width', isMin: false }, { idx: 2, name: 'depth', isMin: true }] },  // 1: Y, x=w,z=0
  { dims: [{ idx: 1, name: 'height', isMin: false }, { idx: 2, name: 'depth', isMin: true }] }, // 2: X, y=h,z=0
  { dims: [{ idx: 0, name: 'width', isMin: true }, { idx: 2, name: 'depth', isMin: true }] },   // 3: Y, x=0,z=0
  { dims: [{ idx: 1, name: 'height', isMin: true }, { idx: 2, name: 'depth', isMin: false }] }, // 4: X, y=0,z=d
  { dims: [{ idx: 0, name: 'width', isMin: false }, { idx: 2, name: 'depth', isMin: false }] }, // 5: Y, x=w,z=d
  { dims: [{ idx: 1, name: 'height', isMin: false }, { idx: 2, name: 'depth', isMin: false }] },// 6: X, y=h,z=d
  { dims: [{ idx: 0, name: 'width', isMin: true }, { idx: 2, name: 'depth', isMin: false }] },  // 7: Y, x=0,z=d
  { dims: [{ idx: 0, name: 'width', isMin: true }, { idx: 1, name: 'height', isMin: true }] },  // 8: Z, x=0,y=0
  { dims: [{ idx: 0, name: 'width', isMin: false }, { idx: 1, name: 'height', isMin: true }] }, // 9: Z, x=w,y=0
  { dims: [{ idx: 0, name: 'width', isMin: false }, { idx: 1, name: 'height', isMin: false }] },// 10: Z, x=w,y=h
  { dims: [{ idx: 0, name: 'width', isMin: true }, { idx: 1, name: 'height', isMin: false }] }, // 11: Z, x=0,y=h
]

export interface EdgeHitResult {
  partId: string
  elementIndex: number
  edgeIndex: number
  point: THREE.Vector3
  mesh: THREE.Mesh
}

export class EdgeEditor {
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private selectedPartId: string | null = null
  private selectedEdgeIndex: number | null = null
  private selectedElementIndex: number = 0
  private highlightLine: THREE.Line | null = null
  private scene: THREE.Scene | null = null

  private dragStartMouse = new THREE.Vector2()
  private isDragging = false
  private dragStartParamValues: Record<string, number> = {}

  private collectMeshes(scene: THREE.Scene): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = []
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.partId && !obj.userData.isGhost && !obj.userData.isHighlight) {
        meshes.push(obj)
      }
    })
    return meshes
  }

  raycastEdge(event: PointerEvent, camera: THREE.PerspectiveCamera, scene: THREE.Scene): EdgeHitResult | null {
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, camera)

    const meshes = this.collectMeshes(scene)
    const intersects = this.raycaster.intersectObjects(meshes, false)

    if (intersects.length > 0) {
      for (const hit of intersects) {
        const mesh = hit.object as THREE.Mesh
        const partId = mesh.userData.partId as string
        if (!partId) continue
        const elementIndex = (mesh.userData.elementIndex as number) ?? 0
        const part = getProject().partMap[partId]
        if (!part) continue

        // Determine edge from face hit
        const normal = hit.face!.normal.clone().transformDirection(mesh.matrixWorld)
        const abs = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)]
        const axis = abs.indexOf(Math.max(...abs))

        let faceId: number
        if (axis === 0) faceId = normal.x > 0 ? 3 : 2
        else if (axis === 1) faceId = normal.y > 0 ? 4 : 5
        else faceId = normal.z > 0 ? 1 : 0

        const [px, py, pz] = part.transform.position
        const elem = part.elements[elementIndex]
        const size = getShapeSize(elem.shape)
        const [w, h, d] = size
        const [ex, ey, ez] = elem.transform.position
        const originX = px + ex
        const originY = py + ey
        const originZ = pz + ez
        const local = new THREE.Vector3(hit.point.x - originX, hit.point.y - originY, hit.point.z - originZ)

        const FACE_VERTICES: Record<number, [number, number, number, number]> = {
          0: [0, 1, 2, 3],
          1: [4, 5, 6, 7],
          2: [0, 3, 7, 4],
          3: [1, 5, 6, 2],
          4: [3, 2, 6, 7],
          5: [0, 4, 5, 1],
        }

        const FACE_TO_EDGES: Record<number, [number, number, number, number]> = {
          0: [0, 1, 2, 3],
          1: [4, 5, 6, 7],
          2: [3, 11, 7, 8],
          3: [9, 5, 10, 1],
          4: [2, 10, 6, 11],
          5: [8, 4, 9, 0],
        }

        const verts = FACE_VERTICES[faceId]
        const edgeIndices = FACE_TO_EDGES[faceId]
        if (!verts || !edgeIndices) continue

        const cornerVerts = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(w, 0, 0),
          new THREE.Vector3(w, h, 0),
          new THREE.Vector3(0, h, 0),
          new THREE.Vector3(0, 0, d),
          new THREE.Vector3(w, 0, d),
          new THREE.Vector3(w, h, d),
          new THREE.Vector3(0, h, d),
        ]

        let minDist = Infinity
        let bestEdgeIdx = 0

        for (let e = 0; e < 4; e++) {
          const vi = verts[e]
          const vj = verts[(e + 1) % 4]
          const p1 = cornerVerts[vi]
          const p2 = cornerVerts[vj]

          const ab = new THREE.Vector3().copy(p2).sub(p1)
          const ap = new THREE.Vector3().copy(local).sub(p1)
          const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)))
          const closest = new THREE.Vector3().copy(p1).addScaledVector(ab, t)
          const dist = closest.distanceTo(local)

          if (dist < minDist) {
            minDist = dist
            bestEdgeIdx = e
          }
        }

        const edgeIndex = edgeIndices[bestEdgeIdx]
        return { partId, elementIndex, edgeIndex, point: hit.point.clone(), mesh }
      }
    }
    return null
  }

  selectEdge(hit: EdgeHitResult, scene: THREE.Scene): void {
    this.clearHighlight()
    this.selectedPartId = hit.partId
    this.selectedEdgeIndex = hit.edgeIndex
    this.selectedElementIndex = hit.elementIndex
    this.scene = scene

    this.highlightLine = this.createEdgeHighlight(hit.mesh, hit.edgeIndex)
    if (this.highlightLine) {
      scene.add(this.highlightLine)
    }
  }

  private getEdgePoints(partId: string, edgeIndex: number): [THREE.Vector3, THREE.Vector3] | null {
    const part = getProject().partMap[partId]
    if (!part) return null

    const elem = part.elements[this.selectedElementIndex]
    if (!elem) return null
    const size = getShapeSize(elem.shape)
    const [w, h, d] = size
    const [px, py, pz] = part.transform.position
    const [ex, ey, ez] = elem.transform.position
    const originX = px + ex
    const originY = py + ey
    const originZ = pz + ez

    const CUBE_EDGES: [number, number][] = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ]

    if (edgeIndex < 0 || edgeIndex >= CUBE_EDGES.length) return null
    const [i, j] = CUBE_EDGES[edgeIndex]

    const corners = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(w, 0, 0),
      new THREE.Vector3(w, h, 0),
      new THREE.Vector3(0, h, 0),
      new THREE.Vector3(0, 0, d),
      new THREE.Vector3(w, 0, d),
      new THREE.Vector3(w, h, d),
      new THREE.Vector3(0, h, d),
    ]

    const p1 = new THREE.Vector3(originX + corners[i].x, originY + corners[i].y, originZ + corners[i].z)
    const p2 = new THREE.Vector3(originX + corners[j].x, originY + corners[j].y, originZ + corners[j].z)
    return [p1, p2]
  }

  private createEdgeHighlight(mesh: THREE.Mesh, edgeIndex: number): THREE.Line | null {
    const partId = mesh.userData.partId as string
    const points = this.getEdgePoints(partId, edgeIndex)
    if (!points) return null

    const mat = new THREE.LineBasicMaterial({
      color: 0xffcc00,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    })

    const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
    const line = new THREE.Line(lineGeo, mat)
    line.userData.isHighlight = true
    return line
  }

  clearHighlight(): void {
    if (this.highlightLine && this.scene) {
      this.scene.remove(this.highlightLine)
      this.highlightLine.geometry.dispose()
      if (Array.isArray(this.highlightLine.material)) {
        this.highlightLine.material.forEach((m) => m.dispose())
      } else {
        this.highlightLine.material.dispose()
      }
      this.highlightLine = null
    }
  }

  startDrag(event: PointerEvent): boolean {
    if (!this.selectedPartId || this.selectedEdgeIndex === null) return false
    const part = getProject().partMap[this.selectedPartId]
    if (!part) return false

    const elementShape = part.elements[this.selectedElementIndex].shape
    const mapping = getEdgeMapping(elementShape, this.selectedEdgeIndex)
    if (!mapping) return false

    this.dragStartMouse.set(event.clientX, event.clientY)
    this.dragStartParamValues = {}
    for (const p of mapping.params) {
      this.dragStartParamValues[p.name] = (elementShape as Record<string, unknown>)[p.name] as number ?? 0
    }

    this.isDragging = true
    return true
  }

  updateDrag(event: PointerEvent, _camera: THREE.PerspectiveCamera, partMeshes: Map<string, THREE.Object3D>): void {
    if (!this.isDragging || !this.selectedPartId || this.selectedEdgeIndex === null) return
    const part = getProject().partMap[this.selectedPartId]
    if (!part) return

    const elementShape = part.elements[this.selectedElementIndex].shape
    const mapping = getEdgeMapping(elementShape, this.selectedEdgeIndex)
    if (!mapping) return

    const delta = (event.clientX - this.dragStartMouse.x) * 0.025 - (event.clientY - this.dragStartMouse.y) * 0.025
    const snapped = Math.round(delta * 2) / 2
    if (snapped === 0) return

    for (const p of mapping.params) {
      const baseVal = this.dragStartParamValues[p.name] ?? 0
      const newValue = Math.max(0.1, baseVal + snapped * p.delta)
      updateElementParam(this.selectedPartId, this.selectedElementIndex, p.name, newValue)
    }

    // Update mesh in scene
    const group = partMeshes.get(this.selectedPartId)
    const updatePartId = this.selectedPartId
    const updateElementIdx = this.selectedElementIndex
    if (group) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.elementIndex === updateElementIdx) {
          child.geometry.dispose()
          const updatedPart = getProject().partMap[updatePartId]
          if (updatedPart) {
            child.geometry = generateGeometry(updatedPart.elements[updateElementIdx].shape)
          }
        }
      })
    }

    // Redraw highlight
    this.clearHighlight()
    if (this.scene && this.selectedEdgeIndex !== null) {
      const group = partMeshes.get(this.selectedPartId)
      if (group) {
        let refMesh: THREE.Mesh | null = null
        group.traverse((child) => {
          if (child instanceof THREE.Mesh && !refMesh) refMesh = child
        })
        if (refMesh) {
          this.highlightLine = this.createEdgeHighlight(refMesh, this.selectedEdgeIndex)
          if (this.highlightLine) this.scene.add(this.highlightLine)
        }
      }
    }
  }

  endDrag(): void {
    this.isDragging = false
  }

  getSelectedEdge(): { partId: string; edgeIndex: number } | null {
    if (!this.selectedPartId || this.selectedEdgeIndex === null) return null
    return { partId: this.selectedPartId, edgeIndex: this.selectedEdgeIndex }
  }

  dispose(): void {
    this.clearHighlight()
  }
}
