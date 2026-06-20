import type { Project } from '../types'

const STORAGE_KEY = 'minecraft-builder:projects'
const CURRENT_PROJECT_KEY = 'minecraft-builder:current'

export function saveProject(project: Project): void {
  try {
    const data = JSON.stringify(project)
    localStorage.setItem(CURRENT_PROJECT_KEY, data)

    const saved = getSavedProjects()
    const existing = saved.findIndex((p: Project) => p.name === project.name)
    if (existing >= 0) {
      saved[existing] = project
    } else {
      saved.push(project)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch (e) {
    console.error('Failed to save project:', e)
  }
}

export function loadCurrentProject(): Project | null {
  try {
    const data = localStorage.getItem(CURRENT_PROJECT_KEY)
    if (!data) return null
    return JSON.parse(data) as Project
  } catch {
    return null
  }
}

export function getSavedProjects(): Project[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data) as Project[]
  } catch {
    return []
  }
}

export function deleteSavedProject(name: string): void {
  const saved = getSavedProjects().filter((p: Project) => p.name !== name)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
}
