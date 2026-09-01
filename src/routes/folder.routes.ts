import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import { createFolderController } from "../controllers/folder.controller.js"

const router = express.Router()

router.post('/', requireAuth, createFolderController)

export default router