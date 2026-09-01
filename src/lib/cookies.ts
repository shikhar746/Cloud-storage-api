import type { Response } from "express"
import { env } from "../config/env.js"

const isProd = env.NODE_ENV === 'production'

const base = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, { ...base, maxAge: 15 * 60 * 1000 })
  res.cookie('refreshToken', refreshToken, {
    ...base,
    path: '/api/auth/refresh',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export function clearAuthCookies(res: Response  ){
    res.clearCookie('accessToken')
    res.clearCookie('refreshToken',{path:'/api/auth/refresh'})
}