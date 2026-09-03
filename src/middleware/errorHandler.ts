import { MulterError } from 'multer'
import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env.js'

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File exceeds the ${env.MAX_FILE_SIZE_BYTES} byte limit`,
        },
      })
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: { code: 'UNEXPECTED_FIELD', message: "Use the field name 'file'" },
      })
    }
    return res.status(400).json({
      error: { code: 'UPLOAD_ERROR', message: err.message },
    })
  }

  console.error('unhandled error', err)
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  })
}