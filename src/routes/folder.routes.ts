import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import { createFolderController, getFolderController, getRootController, deleteFolderController, restoreFolderController } from "../controllers/folder.controller.js"

const router = express.Router()
//create a new folder
router.post('/', requireAuth, createFolderController)

//get root folder
router.get('/root', requireAuth, getRootController)

//get a folder
router.get('/:id', requireAuth, getFolderController)

router.delete("/:id", requireAuth, deleteFolderController)

router.patch('/:id/restore',requireAuth, restoreFolderController)

export default router