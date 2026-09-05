import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import { upload } from "../middleware/upload.js"
import {
  uploadFileController,
  createUploadUrlController,
  completeUploadController,
  getFileController,
  listFileController,
  deleteFileController,
  updateFileController,
  restoreFileController,
  permanentDeleteFileController
} from "../controllers/file.controller.js"

const router = express.Router()

router.get('/', requireAuth, listFileController)

//upload a new file (multipart, at or under MAX_FILE_SIZE_BYTES)
router.post('/upload', requireAuth, upload.single('file'), uploadFileController)

//large files skip the API: ask for a signed URL, PUT straight to storage, then
//come back to /complete so the row gets written
router.post('/upload-url', requireAuth, createUploadUrlController)
router.post('/complete', requireAuth, completeUploadController)

router.get('/:id', requireAuth, getFileController)

router.delete('/:id', requireAuth, deleteFileController)

router.delete('/:id/permanent',requireAuth, permanentDeleteFileController)

router.patch('/:id',requireAuth, updateFileController)

router.patch('/:id/restore',requireAuth, restoreFileController)
export default router