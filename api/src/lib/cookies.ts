import type { Response } from "express"
import { env } from "../config/env.js"

const isProd = env.NODE_ENV === 'production'

const base = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('accessToken', accessToken, { ...base, maxAge: env.ACCESS_TOKEN_TTL.ms })
  res.cookie('refreshToken', refreshToken, {
    ...base,
    path: '/api/auth/refresh',
    maxAge: env.REFRESH_TOKEN_TTL.ms,
  })
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("accessToken", { path: "/" })
  res.clearCookie("refreshToken", { path: "/api/auth/refresh" })
}