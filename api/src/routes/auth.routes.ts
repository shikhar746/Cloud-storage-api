import express from "express"
import { registerController, loginController, googleAuthController, refreshController, logoutController, meController } from "../controllers/auth.controller.js"
import { requireAuth } from "../middleware/requireAuth.js"

const router = express.Router()

router.post('/register', registerController)
router.post('/login', loginController)
router.post('/google', googleAuthController)
router.post('/refresh', refreshController)
router.post('/logout', logoutController)
router.get('/me', requireAuth, meController)

export default router