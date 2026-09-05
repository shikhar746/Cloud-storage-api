import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { lookupUserController } from '../controllers/user.controller.js'

const router = express.Router()

router.get('/lookup', requireAuth, lookupUserController)

export default router
