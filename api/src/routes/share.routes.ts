import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  createShareController,
  listSharesController,
  deleteShareController,
} from '../controllers/share.controller.js'

const router = express.Router()

router.post('/', requireAuth, createShareController)

router.get('/:resourceType/:resourceId', requireAuth, listSharesController)

router.delete('/:id', requireAuth, deleteShareController)

export default router