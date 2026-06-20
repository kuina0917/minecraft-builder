import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createMinecraftGrid } from './Grid'
import { createPartMesh } from '../parts/PartFactory'
import { generateGeometry } from '../parts/GeometryGenerator'
import { getShapeSize } from '../parts/ShapeRegistry'
import { SelectionManager } from './SelectionManager'
import { RotationController } from './RotationController'
import { PlacementController } from './PlacementController'
import { FaceEditor } from './FaceEditor'
import type { Part, ShapeType, BoxParams, WedgeParams } from '../types'
import type { AnchorType } from '../store/placementStore.svelte'
import {
  getStretchMode,
  getSnapUnit,
  setSelectionMode,
  setSnapUnit,
  getSelectionMode,
  setScaleAnchor,
  isBooleanMode,
  getBooleanOp,
  getBooleanSourceId,
  setBooleanSourceId,
  cancelBooleanMode,
} from '../store/placementStore.svelte'
import {
  getProject,
  getSelectedPartId,
  updateTransform,
  toggleSelectPart,
  removePart,
  mergeSelected,
  ungroupSelected,
  undo,
  snapshot,
  bumpRevision,
  isWireframeEnabled,
  setWireframeEnabled,
  booleanAdd,
  booleanSubtract,
  booleanIntersect,
} from '../store/projectStore.svelte'

export class ViewportManager {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  selection: SelectionManager
  rotationController: RotationController
  placement: PlacementController
  faceEditor: FaceEditor
  partMeshes = new Map<string, THREE.Object3D>()

  private container: HTMLElement
  private animationId: number = 0
  private dragStart = new THREE.Vector2()
  private isDragging = false
  private clickThreshold = 5
  private placementHold = false
  private lastPlacedPos = new THREE.Vector3()
  private lastPlaceTime = 0
  private readonly PLACE_INTERVAL = 80

  private moveActive = false
  private movePartId: string | null = null
  private movePlane = new THREE.Plane()
  private moveIntersection = new THREE.Vector3()
  private moveOffset = new THREE.Vector3()
  private moveStartPos: [number, number, number] | null = null
  private moveMergedStarts: Map<string, [number, number, number]> = new Map()

  private scaleActive = false
  private scalePartId: string | null = null
  private scaleAnchor: AnchorType = 'se'
  private scaleStartDims: Array<{
    index: number
    pos: [number, number, number]
    dims: Record<string, number>
  }> = []
  private scaleStartX = 0
  private scaleStartY = 0

  suppressRebuild = false

  onSelect: ((id: string | null) => void) | null = null
  onAddPart: ((type: ShapeType, position: [number, number, number]) => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    )
    this.camera.position.set(6, 5, 6)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.domElement.tabIndex = 0
    container.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.1
    this.controls.minDistance = 2
    this.controls.maxDistance = 100
    this.controls.update()

    this.selection = new SelectionManager()
    this.rotationController = new RotationController()
    this.placement = new PlacementController()
    this.faceEditor = new FaceEditor()

    this.setupLights()
    this.setupGrid()
    this.setupInteraction()

    const resizeObserver = new ResizeObserver(() => this.resize())
    resizeObserver.observe(container)
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0x404060, 0.6)
    this.scene.add(ambient)

    const directional = new THREE.DirectionalLight(0xffffff, 0.8)
    directional.position.set(10, 20, 10)
    directional.castShadow = true
    this.scene.add(directional)

    const fill = new THREE.DirectionalLight(0x8888ff, 0.3)
    fill.position.set(-10, 5, -10)
    this.scene.add(fill)
  }

  private setupGrid(): void {
    const grid = createMinecraftGrid(32, 32)
    this.scene.add(grid)
  }

  // ===== KEYBOARD SHORTCUTS =====
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault(); undo(); this.syncAllMeshes(); return
      }
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault(); mergeSelected(); this.syncAllMeshes(); return
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'g') {
        e.preventDefault(); ungroupSelected(); this.syncAllMeshes(); return
      }

      if (e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        setSelectionMode('object')
        this.faceEditor.clearHighlight()
        return
      }

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setSelectionMode('scale')
        this.faceEditor.clearHighlight()
        return
      }

      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        setWireframeEnabled(!isWireframeEnabled())
        this.updateWireframeMode()
        return
      }

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        const ids = this.selection.getSelectedPartIds()
        if (ids.length > 0) {
          if (this.rotationController.isVisible()) this.rotationController.hide()
          else this.rotationController.show(ids[0], this.scene)
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const ids = this.selection.getSelectedPartIds()
        if (ids.length > 0) {
          e.preventDefault()
          for (const id of ids) {
            import('../store/projectStore.svelte').then(({ removePart }) => {
              this.removePartFromScene(id); removePart(id)
            })
          }
          this.selection.clearHighlight()
        }
        return
      }

      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setSnapUnit(getSnapUnit() >= 1 ? 2 : getSnapUnit() + 0.5)
        return
      }
      if (e.key === '-') {
        e.preventDefault()
        setSnapUnit(getSnapUnit() <= 0.5 ? 0.25 : getSnapUnit() - 0.5)
        return
      }

      const shapeKeys: Record<string, ShapeType> = {
        '1': 'box', '2': 'radial', '3': 'sphere',
        '4': 'wedge', '5': 'ring', '6': 'pipe', '7': 'air',
      }
      if (e.key in shapeKeys) {
        e.preventDefault()
        this.startPlacement(shapeKeys[e.key])
      }
    })
  }

  private updateWireframeMode(): void {
    const wf = isWireframeEnabled()
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.partId) {
        const mat = obj.material
        const materials = Array.isArray(mat) ? mat : [mat]
        for (const m of materials) {
          if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshBasicMaterial) m.wireframe = wf
        }
      }
    })
  }

  private getDimKeys(type: ShapeType): string[] {
    const map: Record<string, string[]> = {
      box: ['width', 'height', 'depth'],
      radial: ['height', 'topRadius', 'bottomRadius'],
      sphere: ['radius'],
      wedge: ['width', 'height', 'depth'],
      ring: ['outerRadius', 'innerRadius', 'height'],
      pipe: ['outerRadius', 'innerRadius', 'height'],
    }
    return map[type] ?? []
  }

  private updatePartMeshInScene(partId: string): void {
    const group = this.partMeshes.get(partId)
    if (!group) return
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData.partId) {
        const ei = child.userData.elementIndex as number ?? 0
        const part = getProject().partMap[partId]
        if (!part) return
        const el = part.elements[ei]
        if (!el) return
        child.geometry.dispose()
        child.geometry = generateGeometry(el.shape)
        const size = getShapeSize(el.shape)
        child.position.set(
          el.transform.position[0] + size[0] / 2,
          el.transform.position[1] + size[1] / 2,
          el.transform.position[2] + size[2] / 2
        )
      }
    })
  }

  // ===== POINTER HANDLERS =====

  private handlePointerDown(e: PointerEvent): void {
    this.dragStart.set(e.clientX, e.clientY)
    this.isDragging = false

    if (e.button !== 0) return

    if (this.placement.active) {
      this.placementHold = true
      this.renderer.domElement.setPointerCapture(e.pointerId)
      const pos = this.placement.tryPlace(e, this.camera)
      if (pos) { this.lastPlacedPos.copy(pos); this.lastPlaceTime = performance.now() }
      return
    }

    if (this.rotationController.isVisible()) {
      const axis = this.rotationController.raycastAxis(e, this.camera)
      if (axis) {
        this.rotationController.startDrag(axis, e)
        this.renderer.domElement.setPointerCapture(e.pointerId)
        this.controls.enabled = false
        return
      }
    }

    // === BOOLEAN MODE: click to select source/target ===
    if (isBooleanMode()) {
      const hit = this.faceEditor.raycastFace(e, this.camera, this.scene)
      if (hit) {
        const sourceId = getBooleanSourceId()
        if (!sourceId) {
          setBooleanSourceId(hit.partId)
        } else {
          const op = getBooleanOp()
          if (op && hit.partId !== sourceId) {
            switch (op) {
              case 'add': booleanAdd(sourceId, hit.partId); break
              case 'subtract': booleanSubtract(sourceId, hit.partId); break
              case 'intersect': booleanIntersect(sourceId, hit.partId); break
            }
          }
          cancelBooleanMode()
        }
      } else {
        cancelBooleanMode()
      }
      return
    }

    const mode = getSelectionMode()

    // === STRETCH MODE: click = select face (toggle), drag = resize ===
    if (getStretchMode()) {
      const faceHit = this.faceEditor.raycastFace(e, this.camera, this.scene)
      if (faceHit) {
        const current = this.faceEditor.getSelectedFace()
        if (current && current.partId === faceHit.partId && current.direction === faceHit.direction) {
          // Click same face → deselect (reset selection state + highlight)
          this.faceEditor.deselect()
        } else {
          // Click different/new face → select + highlight
          this.faceEditor.selectFace(faceHit, this.scene)
          this.renderer.domElement.setPointerCapture(e.pointerId)
        }
      } else {
        // Clicked empty space → clear selection
        this.faceEditor.deselect()
      }
      return
    }

    // === FACE MODE (F key): immediate drag ===
    if (mode === 'face') {
      const faceHit = this.faceEditor.raycastFace(e, this.camera, this.scene)
      if (faceHit) {
        this.faceEditor.selectFace(faceHit, this.scene)
        this.faceEditor.startDrag(e, this.camera)
        this.suppressRebuild = true
        this.renderer.domElement.setPointerCapture(e.pointerId)
        this.controls.enabled = false
      }
      return
    }

    // === SCALE MODE (S key): anchor-based grid expansion ===
    if (mode === 'scale') {
      const faceHit = this.faceEditor.raycastFace(e, this.camera, this.scene)
      if (faceHit) {
        const part = getProject().partMap[faceHit.partId]
        if (part && (part.elements[0]?.shape?.type ?? 'box') !== 'air') {
          this.scalePartId = faceHit.partId
          this.scaleStartX = e.clientX
          this.scaleStartY = e.clientY

          const el = part.elements[faceHit.elementIndex]
          if (el) {
            const size = getShapeSize(el.shape)
            const cx = part.transform.position[0] + el.transform.position[0] + size[0] / 2
            const cz = part.transform.position[2] + el.transform.position[2] + size[2] / 2
            const hitX = faceHit.point.x
            const hitZ = faceHit.point.z
            if (hitX >= cx && hitZ >= cz) this.scaleAnchor = 'se'
            else if (hitX < cx && hitZ >= cz) this.scaleAnchor = 'sw'
            else if (hitX >= cx && hitZ < cz) this.scaleAnchor = 'ne'
            else this.scaleAnchor = 'nw'
            setScaleAnchor(this.scaleAnchor)
          }

          this.scaleStartDims = part.elements.map((el, i) => {
            const dims: Record<string, number> = {}
            const keys = this.getDimKeys(el.shape.type)
            for (const k of keys) {
              dims[k] = (el.shape as Record<string, number>)[k]
            }
            return { index: i, pos: [...el.transform.position] as [number, number, number], dims }
          })
          snapshot()
          this.scaleActive = true
          this.suppressRebuild = true
          this.renderer.domElement.setPointerCapture(e.pointerId)
          this.controls.enabled = false
        }
      }
      return
    }

    // === OBJECT MODE: move ===
    if (mode === 'object') {
      const hit = this.selection.raycastFace(e, this.camera, this.scene)
      if (hit) {
        const part = getProject().partMap[hit.partId]
        if (part && (part.elements[0]?.shape?.type ?? 'box') !== 'air') {
          this.controls.enabled = false
          this.moveActive = true
          this.movePartId = hit.partId
          this.moveStartPos = [...part.transform.position]
          this.moveMergedStarts.clear()
          if (part.mergedPartIds) {
            for (const mid of part.mergedPartIds) {
              const mp = getProject().partMap[mid]
              if (mp) this.moveMergedStarts.set(mid, [...mp.transform.position])
            }
          }
          this.renderer.domElement.setPointerCapture(e.pointerId)

          const camDir = new THREE.Vector3()
          this.camera.getWorldDirection(camDir)
          this.movePlane.setFromNormalAndCoplanarPoint(camDir, hit.point)

          const mesh = this.partMeshes.get(hit.partId)
          if (mesh) this.moveOffset.copy(mesh.position).sub(hit.point)
          return
        }
      }
    }

    this.renderer.domElement.setPointerCapture(e.pointerId)
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.placement.active) {
      if (this.placementHold) {
        const pos = this.placement.getSnappedPosition(e, this.camera, this.scene)
        if (pos) {
          this.placement.updatePreviewAt(pos)
          const now = performance.now()
          if (now - this.lastPlaceTime >= this.PLACE_INTERVAL && !pos.equals(this.lastPlacedPos)) {
            this.lastPlacedPos.copy(pos)
            this.lastPlaceTime = now
            this.placement.placeAt(pos)
          }
        }
      } else {
        this.placement.updatePreview(e, this.camera)
      }
      return
    }

    if (this.rotationController['isDragging']) {
      this.rotationController.updateDrag(e, this.partMeshes)
      return
    }

    // === STRETCH MODE drag ===
    // If stretch mode is on and no drag is active yet, check if we should start one
    if (getStretchMode() && !this.faceEditor['isDragging']) {
      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y
      if (Math.abs(dx) > this.clickThreshold || Math.abs(dy) > this.clickThreshold) {
        // Start drag if a face is currently selected
        const selected = this.faceEditor.getSelectedFace()
        if (selected) {
          this.faceEditor.startDrag(e as unknown as PointerEvent, this.camera)
          this.suppressRebuild = true
          this.controls.enabled = false
        }
      }
    }

    // FaceEditor drag (stretch mode or face mode)
    if (this.faceEditor['isDragging']) {
      this.faceEditor.updateDrag(e, this.camera, this.partMeshes)
      return
    }

    // Scale drag - Anchor determined at click time
    if (this.scaleActive && this.scalePartId) {
      const sx = e.clientX - this.scaleStartX
      const sy = e.clientY - this.scaleStartY
      const unit = getSnapUnit()
      const anchor = this.scaleAnchor
      const part = getProject().partMap[this.scalePartId]
      if (part) {
        const forward = this.camera.getWorldDirection(new THREE.Vector3())
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

        const rightXZ = new THREE.Vector2(right.x, right.z).normalize()
        const downXZ = new THREE.Vector2(-forward.x, -forward.z).normalize()

        let growthXZ: THREE.Vector2
        if (anchor === 'se') growthXZ = new THREE.Vector2(1, 1)
        else if (anchor === 'sw') growthXZ = new THREE.Vector2(-1, 1)
        else if (anchor === 'ne') growthXZ = new THREE.Vector2(1, -1)
        else growthXZ = new THREE.Vector2(-1, -1)
        growthXZ.normalize()

        const proj = sx * rightXZ.dot(growthXZ) + sy * downXZ.dot(growthXZ)
        const steps = Math.round(proj / 20)
        for (const sd of this.scaleStartDims) {
          const el = part.elements[sd.index]
          if (!el) continue
          if (el.shape.type === 'box' || el.shape.type === 'wedge') {
            const deltaW = steps * unit
            const deltaD = steps * unit
            const newW = Math.max(unit, sd.dims.width + deltaW)
            const newD = Math.max(unit, sd.dims.depth + deltaD)
            const shape = el.shape as BoxParams | WedgeParams
            shape.width = newW
            shape.depth = newD
            const pos = [...sd.pos] as [number, number, number]
            if (anchor === 'ne' || anchor === 'nw') {
              pos[2] = sd.pos[2] + sd.dims.depth - newD
            }
            if (anchor === 'sw' || anchor === 'nw') {
              pos[0] = sd.pos[0] + sd.dims.width - newW
            }
            el.transform.position = pos
          } else {
            const delta = steps * unit
            const keys = this.getDimKeys(el.shape.type)
            for (const k of keys) {
              const oldVal = sd.dims[k]
              if (oldVal <= 0) continue
              ;(el.shape as Record<string, number>)[k] = Math.max(unit, Math.round((oldVal + delta) / unit) * unit)
            }
          }
        }
        this.updatePartMeshInScene(this.scalePartId)
      }
      return
    }

    // Object move
    if (this.moveActive && this.movePartId) {
      const rect = this.renderer.domElement.getBoundingClientRect()
      const pointer = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(pointer, this.camera)
      if (raycaster.ray.intersectPlane(this.movePlane, this.moveIntersection)) {
        const newPosWorld = this.moveIntersection.clone().add(this.moveOffset)
        const part = getProject().partMap[this.movePartId]
        if (part) {
          const newPos: [number, number, number] = [
            Math.round(newPosWorld.x),
            Math.round(newPosWorld.y),
            Math.round(newPosWorld.z),
          ]
          updateTransform(this.movePartId, { position: newPos })
          const mesh = this.partMeshes.get(this.movePartId)
          if (mesh) mesh.position.set(newPos[0], newPos[1], newPos[2])

          if (this.moveStartPos && part.mergedPartIds) {
            const dx = newPos[0] - this.moveStartPos[0]
            const dy = newPos[1] - this.moveStartPos[1]
            const dz = newPos[2] - this.moveStartPos[2]
            for (const mid of part.mergedPartIds) {
              const startP = this.moveMergedStarts.get(mid)
              if (!startP) continue
              const mergedNewPos: [number, number, number] = [startP[0] + dx, startP[1] + dy, startP[2] + dz]
              const mp = getProject().partMap[mid]
              if (mp) {
                updateTransform(mid, { position: mergedNewPos })
                const mm = this.partMeshes.get(mid)
                if (mm) mm.position.set(mergedNewPos[0], mergedNewPos[1], mergedNewPos[2])
              }
            }
          }
        }
      }
      return
    }

    if (!this.isDragging) {
      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y
      if (Math.abs(dx) > this.clickThreshold || Math.abs(dy) > this.clickThreshold) {
        this.isDragging = true
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (this.placement.active) {
      if (e.button === 2) {
        this.placement.stop(); this.controls.enabled = true; this.renderer.domElement.style.cursor = 'default'
        return
      }
      if (this.placementHold) { this.placementHold = false; this.renderer.domElement.releasePointerCapture(e.pointerId) }
      return
    }

    if (this.rotationController['isDragging']) {
      this.rotationController.endDrag()
      this.renderer.domElement.releasePointerCapture(e.pointerId)
      this.controls.enabled = true
      return
    }

    // FaceEditor drag end (stretch mode or face mode)
    if (this.faceEditor['isDragging']) {
      this.faceEditor.endDrag()
      this.suppressRebuild = false
      this.renderer.domElement.releasePointerCapture(e.pointerId)
      this.controls.enabled = true
      return
    }

    // Scale drag end
    if (this.scaleActive) {
      this.scaleActive = false
      this.scalePartId = null
      this.scaleStartDims = []
      bumpRevision()
      this.suppressRebuild = false
      this.renderer.domElement.releasePointerCapture(e.pointerId)
      this.controls.enabled = true
      return
    }

    // Stretch mode click (no drag) - release pointer capture, keep highlight
    if (getStretchMode()) {
      this.renderer.domElement.releasePointerCapture(e.pointerId)
      return
    }

    if (this.moveActive && this.movePartId) {
      const movedPartId = this.movePartId
      this.moveActive = false; this.movePartId = null
      this.moveStartPos = null; this.moveMergedStarts.clear()
      this.renderer.domElement.releasePointerCapture(e.pointerId)
      this.controls.enabled = true

      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y
      if (Math.abs(dx) < this.clickThreshold && Math.abs(dy) < this.clickThreshold && e.button === 0) {
        if (getSelectionMode() === 'object') {
          this.onSelect?.(movedPartId)
          this.rotationController.show(movedPartId, this.scene)
        }
      }
      return
    }

    // Click (no drag) in object mode
    const dx = e.clientX - this.dragStart.x
    const dy = e.clientY - this.dragStart.y
    if (Math.abs(dx) < this.clickThreshold && Math.abs(dy) < this.clickThreshold) {
      if (getStretchMode()) return // stretch mode handles selection on pointerdown
      if (getSelectionMode() !== 'object') return

      // Ctrl+Right click: delete clicked part
      if (e.ctrlKey && e.button === 2) {
        const hit = this.selection.raycastFace(e, this.camera, this.scene)
        if (hit) {
          this.removePartFromScene(hit.partId)
          removePart(hit.partId)
          this.selection.clearHighlight()
          this.rotationController.hide()
        }
        return
      }

      if (e.button === 0) {
        if (e.ctrlKey) {
          const id = this.selection.select(e, this.camera, this.scene, true)
          if (id) toggleSelectPart(id)
        } else {
          const id = this.selection.select(e, this.camera, this.scene)
          this.onSelect?.(id)
          if (id) {
            this.selection.highlightCombined(id, getProject().partMap, this.scene)
            this.rotationController.show(id, this.scene)
          } else {
            this.rotationController.hide()
          }
        }
      }
    }
  }

  private setupInteraction(): void {
    const canvas = this.renderer.domElement

    canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e))
    canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e))
    canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e))

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      if (this.placement.active) {
        this.placement.stop()
        this.controls.enabled = true
        canvas.style.cursor = 'default'
      }
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.placement.active) {
        this.placement.stop()
        this.controls.enabled = true
        canvas.style.cursor = 'default'
        e.preventDefault()
      }
      if (e.key === 'Escape') {
        if (isBooleanMode()) {
          cancelBooleanMode()
          return
        }
        this.rotationController.hide()
        this.faceEditor.clearHighlight()
        setSelectionMode('object')
      }
    })

    this.setupKeyboardShortcuts()
  }

  startPlacement(type: ShapeType): void {
    this.selection.clearHighlight()
    this.rotationController.hide()
    this.placement.start(type, this.scene, (shapeType, position) => {
      this.onAddPart?.(shapeType, position)
    })
    this.controls.enabled = false
    this.renderer.domElement.style.cursor = 'crosshair'
    this.renderer.domElement.focus()
  }

  addPartToScene(part: Part): THREE.Object3D {
    const obj = createPartMesh(part)
    obj.visible = part.visible
    if (!part.visible) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) child.visible = false
      })
    }
    this.scene.add(obj)
    this.partMeshes.set(part.id, obj)
    return obj
  }

  removePartFromScene(id: string): void {
    const obj = this.partMeshes.get(id)
    if (!obj) return
    this.scene.remove(obj)
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose())
        else child.material.dispose()
      }
    })
    this.partMeshes.delete(id)
  }

  updatePartInScene(id: string, part: Part): void {
    this.removePartFromScene(id)
    this.addPartToScene(part)
  }

  syncAllMeshes(): void {
    const project = getProject()
    const currentIds = new Set(this.partMeshes.keys())
    const projectIds = new Set(Object.keys(project.partMap))

    for (const id of currentIds) {
      if (!projectIds.has(id)) this.removePartFromScene(id)
    }
    for (const id of projectIds) {
      const part = project.partMap[id]
      if (!part) continue
      if (currentIds.has(id)) { this.removePartFromScene(id); this.addPartToScene(part) }
      else { this.addPartToScene(part) }
    }
  }

  clearScene(): void {
    for (const id of Array.from(this.partMeshes.keys())) this.removePartFromScene(id)
  }

  private resize(): void {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  syncHighlight(): void {
    const id = getSelectedPartId()
    this.selection.clearHighlight()
    if (id) {
      const mesh = this.partMeshes.get(id)
      if (mesh) {
        if (mesh instanceof THREE.Mesh) {
          this.selection.highlight(mesh)
        } else {
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.partId === id) {
              this.selection.highlight(child)
            }
          })
        }
      }
      this.selection.highlightCombined(id, getProject().partMap, this.scene)
    }
  }

  start(): void {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }

  stop(): void { cancelAnimationFrame(this.animationId) }

  dispose(): void {
    this.stop()
    this.clearScene()
    this.selection.dispose()
    this.rotationController.dispose()
    this.placement.stop()
    this.renderer.dispose()
    this.controls.dispose()
  }
}
