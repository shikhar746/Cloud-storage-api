import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import { upload } from "../middleware/upload.js"
import { uploadFileController, getFileController, listFileController, deleteFileController} from "../controllers/file.controller.js"

const router = express.Router()

router.get('/',requireAuth, listFileController)

//upload a new file
router.post('/upload', requireAuth, upload.single('file'), uploadFileController)

router.get('/:id', requireAuth, getFileController)

router.delete('/:id', requireAuth, deleteFileController)

export default router