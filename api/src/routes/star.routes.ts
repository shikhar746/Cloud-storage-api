import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  createStarController,
  listStarredController,
  deleteStarController,
} from '../controllers/star.controller.js'

const router = express.Router()

router.post('/', requireAuth, createStarController)

router.get('/', requireAuth, listStarredController)

router.delete('/:resourceType/:resourceId', requireAuth, deleteStarController)

export default router
