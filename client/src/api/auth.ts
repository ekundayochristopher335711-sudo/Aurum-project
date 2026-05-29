import api from '../lib/axios'
import type { User } from '../types'

export const login = (email: string, password: string) =>
  api.post<{ user: User; token: string }>('/auth/login', { email, password }).then((r) => r.data)

export const register = (data: { email: string; password: string; name: string; role?: string }) =>
  api.post<{ user: User; token: string }>('/auth/register', data).then((r) => r.data)

export const getMe = () =>
  api.get<User>('/auth/me').then((r) => r.data)

export const getUsers = () =>
  api.get<User[]>('/auth/users').then((r) => r.data)
