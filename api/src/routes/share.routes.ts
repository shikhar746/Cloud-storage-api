import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  createShareController,
  listSharesController,
  listSharedWithMeController,
  deleteShareController,
} from '../controllers/share.controller.js'

const router = express.Router()

router.post('/', requireAuth, createShareController)

// literal path first, so it is never read as a :resourceType
router.get('/shared-with-me', requireAuth, listSharedWithMeController)

router.get('/:resourceType/:resourceId', requireAuth, listSharesController)

router.delete('/:id', requireAuth, deleteShareController)

export default router