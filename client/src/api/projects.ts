import api from '../lib/axios'
import type { Project } from '../types'

export const getProjects = () => api.get<Project[]>('/projects').then((r) => r.data)

export const getProject = (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data)

export const createProject = (data: Partial<Project>) =>
  api.post<Project>('/projects', data).then((r) => r.data)

export const updateProject = (id: string, data: Partial<Project>) =>
  api.put<Project>(`/projects/${id}`, data).then((r) => r.data)

export const addProjectMember = (projectId: string, userId: string, role: string) =>
  api.post(`/projects/${projectId}/members`, { userId, role }).then((r) => r.data)
