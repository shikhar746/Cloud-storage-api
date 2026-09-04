import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import { createFolderController, getFolderController, getRootController, deleteFolderController, restoreFolderController, getTrashController, updateFolderController, permanentDeleteFolderController} from "../controllers/folder.controller.js"

const router = express.Router()
//create a new folder
router.post('/', requireAuth, createFolderController)

//get root folder
router.get('/root', requireAuth, getRootController)


router.delete("/:id", requireAuth, deleteFolderController)

router.patch('/:id/restore',requireAuth, restoreFolderController)

router.delete("/:id/permanent",requireAuth, permanentDeleteFolderController)

router.get("/trash", requireAuth, getTrashController)

//get a folder
router.get('/:id', requireAuth, getFolderController)

router.patch('/:id', requireAuth, updateFolderController)
export default router