import crypto from 'crypto'
import type { Request, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { env } from '../config/env.js'
import { uploadFileSchema } from '../schemas/file.schema.js'

export async function uploadFileController(req: Request, res: Response) {
  // 1. multer puts the file here — no file means nothing to do
  if (!req.file) {
    return res.status(400).json({
      error: { code: "NO_FILE", message: "No file uploaded" },
    })
  }
}