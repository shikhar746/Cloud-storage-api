import express from 'express'
import {
  getPublicShareController,
  accessPublicShareController,
  browsePublicShareController,
  publicFileController,
} from '../controllers/publicShare.controller.js'

const router = express.Router()

// Deliberately NO requireAuth on this router: holding the token IS the
// credential. Every handler re-checks the token, its expiry, and its password
// on each call rather than trusting a previous one.

// what this link is, without revealing anything a password should protect
router.get('/:token', getPublicShareController)

// open it: a signed URL for a file, or a listing for a folder
router.post('/:token/access', accessPublicShareController)

// walk into a subfolder of a shared folder
router.post('/:token/folder/:folderId', browsePublicShareController)

// download one file reached through the link
router.post('/:token/file/:fileId', publicFileController)

export default router
