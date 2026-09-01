import type { Request, Response } from "express";
import bcrypt from "bcryptjs"
import { registerSchema } from "../schemas/auth.schema.js";
import { loginSchema } from "../schemas/auth.schema.js"
import { supabase } from "../lib/supabase.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens.js";
import { setAuthCookies, clearAuthCookies } from "../lib/cookies.js";



export const registerController = async (req: Request, res: Response) => {
    const { success, error, data } = registerSchema.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", issues: error.issues },
        })
    }

    const email = data.email.toLowerCase().trim()
    const passwordHash = await bcrypt.hash(data.password, 10)

    const { data: user, error: dbError } = await supabase
        .from("users")
        .insert({
            email,
            password_hash: passwordHash,
            name: data.name
        })
        .select("id, email, name")
        .single()

    if (dbError) {
        if (dbError.code === "23505") {
            return res.status(409).json({
                error: { code: "EMAIL_ALREADY_IN_USE", message: "Email already registered" }
            })
        }
        console.error("register insert failed", dbError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Could not create account" }
        })
    }
    const accessToken = signAccessToken(user.id)
    const refreshToken = signRefreshToken(user.id)

    setAuthCookies(res, accessToken, refreshToken)

    return res.status(201).json({ user })
}

export const loginController = async (req: Request, res: Response) => {
    const { success, error, data } = loginSchema.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", issues: error.issues },
        })
    }
    const email = data.email.toLowerCase().trim()
    const { data: user, error: dbError } = await supabase
        .from("users")
        .select("id, email, name, password_hash")
        .eq("email", email)
        .single()

    if (dbError || !user) {
        return res.status(401).json({
            error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        })
    }

    const ok = await bcrypt.compare(data.password, user.password_hash)
    if (!ok) {
        return res.status(401).json({
            error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
        })
    }
    const accessToken = signAccessToken(user.id)
    const refreshToken = signRefreshToken(user.id)

    setAuthCookies(res, accessToken, refreshToken)

    return res.status(200).json({
        user: { id: user.id, email: user.email, name: user.name },
    })

}

export const meController = async (req: Request, res: Response) => {
    if (!req.userId) {
        return res.status(401).json({
            error: { code: "UNAUTHENTICATED", message: "User not authenticated" },
        })
    }

    const { data: user, error: dbError } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("id", req.userId)
        .single()

    if (dbError || !user) {
        return res.status(401).json({
            error: { code: "UNAUTHENTICATED", message: "Not logged in" },
        })
    }

    return res.status(200).json({ user })
}

export const refreshController = async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken
    if (!refreshToken) {
        return res.status(401).json({
            error: { code: "NO_REFRESH_TOKEN", message: "No refresh token provided" },
        })
    }
    const payload = verifyRefreshToken(refreshToken)
    if (!payload) {
        return res.status(401).json({
            error: { code: "INVALID_REFRESH_TOKEN", message: "Session expired" },
        })
    }
    const { data: user, error: dbError } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("id", payload.sub)
        .single()
    if (dbError || !user) {
        return res.status(401).json({
            error: { code: "UNAUTHENTICATED", message: "Not logged in" },
        })
    }

    const accessToken = signAccessToken(user.id)
    const newrefreshToken = signRefreshToken(user.id)

    setAuthCookies(res, accessToken, newrefreshToken)

    return res.status(200).json({ user })
}

export const logoutController = async (_req: Request, res: Response)=>{
    
    clearAuthCookies(res)
    
    return res.status(200).json({success: true})
}