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
  // a browser only drops a cookie when the clearing Set-Cookie repeats the
  // attributes it was written with — miss secure/sameSite in production and
  // logout leaves the session cookie alive
  res.clearCookie("accessToken", { ...base, path: "/" })
  res.clearCookie("refreshToken", { ...base, path: "/api/auth/refresh" })
}