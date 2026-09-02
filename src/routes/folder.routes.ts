import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import { createFolderController, getFolderController, getRootController } from "../controllers/folder.controller.js"

const router = express.Router()
//create a new folder
router.post('/', requireAuth, createFolderController)

//get a folder
router.get('/:id', requireAuth, getFolderController)

//get root folder
router.get('/root', requireAuth, getRootController)

export default router