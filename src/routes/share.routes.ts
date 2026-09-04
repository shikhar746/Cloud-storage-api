import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { createShareController } from '../controllers/share.controller.js'

const router = express.Router()

router.post('/', requireAuth, createShareController)

export default router