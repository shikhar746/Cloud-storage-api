import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import { searchController } from '../controllers/search.controller.js'

const router = express.Router()

router.get('/', requireAuth, searchController)

export default router