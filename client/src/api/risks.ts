import api from '../lib/axios'
import type { RiskItem } from '../types'

const base = (pid: string) => `/projects/${pid}/risks`

export const getRisks = (projectId: string, status?: string) =>
  api.get<RiskItem[]>(base(projectId), { params: status ? { status } : {} }).then((r) => r.data)

export const getRisk = (projectId: string, id: string) =>
  api.get<RiskItem>(`${base(projectId)}/${id}`).then((r) => r.data)

export const createRisk = (projectId: string, data: Partial<RiskItem>) =>
  api.post<RiskItem>(base(projectId), data).then((r) => r.data)

export const updateRisk = (projectId: string, id: string, data: Partial<RiskItem>) =>
  api.put<RiskItem>(`${base(projectId)}/${id}`, data).then((r) => r.data)

export const deleteRisk = (projectId: string, id: string) =>
  api.delete(`${base(projectId)}/${id}`)
