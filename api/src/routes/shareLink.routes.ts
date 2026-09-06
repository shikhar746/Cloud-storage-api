import express from 'express'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  createShareLinkController,
  listShareLinksController,
  deleteShareLinkController,
} from '../controllers/shareLink.controller.js'

const router = express.Router()

router.post('/', requireAuth, createShareLinkController)

router.get('/:resourceType/:resourceId', requireAuth, listShareLinksController)

router.delete('/:id', requireAuth, deleteShareLinkController)

export default router
