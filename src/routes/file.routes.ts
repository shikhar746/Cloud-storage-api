import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import { upload } from "../middleware/upload.js"
import { uploadFileController, getFileController } from "../controllers/file.controller.js"

const router = express.Router()

//upload a new file
router.post('/upload', requireAuth, upload.single('file'), uploadFileController)

router.get('/:id', requireAuth, getFileController)

export default router