import express from "express"
import { requireAuth } from "../middleware/requireAuth.js"
import {
    createFolderController,
    getFolderController,
    getRootController,
    deleteFolderController,
    restoreFolderController,
    getTrashController,
    updateFolderController,
    permanentDeleteFolderController,
    getFolderPathController,
    emptyTrashController
} from "../controllers/folder.controller.js"

const router = express.Router()
//create a new folder
router.post('/', requireAuth, createFolderController)

// literal paths first — "/trash" would otherwise be read as an :id
router.get('/root', requireAuth, getRootController)

router.get("/trash", requireAuth, getTrashController)

//empty the whole trash in one call
router.delete("/trash", requireAuth, emptyTrashController)

router.delete("/:id", requireAuth, deleteFolderController)

router.patch('/:id/restore',requireAuth, restoreFolderController)

router.delete("/:id/permanent",requireAuth, permanentDeleteFolderController)

//ancestor chain, for breadcrumbs that survive a refresh
router.get('/:id/path', requireAuth, getFolderPathController)

//get a folder
router.get('/:id', requireAuth, getFolderController)

router.patch('/:id', requireAuth, updateFolderController)
export default router