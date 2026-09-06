import express from 'express'
import { purgeTrashController } from '../controllers/maintenance.controller.js'

const router = express.Router()

// no requireAuth: this is called by a scheduler, not a browser, and is
// guarded by the PURGE_SECRET header instead of a session cookie
router.post('/purge-trash', purgeTrashController)

export default router
