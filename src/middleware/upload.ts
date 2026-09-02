import multer from 'multer'
import { env } from '../config/env.js'

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: env.MAX_FILE_SIZE_BYTES,
    },
})