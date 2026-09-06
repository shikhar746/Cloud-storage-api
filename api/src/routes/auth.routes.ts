import express from "express"
import { registerController, loginController, googleAuthController, refreshController, logoutController, meController } from "../controllers/auth.controller.js"
import { requireAuth } from "../middleware/requireAuth.js"
import { authLimiter } from "../middleware/rateLimit.js"

const router = express.Router()

router.post('/register', authLimiter, registerController)
router.post('/login', authLimiter, loginController)
router.post('/google', authLimiter, googleAuthController)
router.post('/refresh', refreshController)
router.post('/logout', logoutController)
router.get('/me', requireAuth, meController)

export default router