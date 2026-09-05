import type { Request, Response, NextFunction } from "express"
import { verifyAccessToken } from "../lib/tokens.js"

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.accessToken

  if (!token) {
    return res.status(401).json({
      error: { code: "UNAUTHENTICATED", message: "Not logged in" },
    })
  }

  const payload = verifyAccessToken(token)

  if (!payload) {
    return res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Session expired" },
    })
  }

  req.userId = payload.sub
  next()
}