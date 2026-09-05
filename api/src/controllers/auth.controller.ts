import type { Request, Response } from "express";
import bcrypt from "bcryptjs"
import { registerSchema } from "../schemas/auth.schema.js";
import { loginSchema, googleAuthSchema } from "../schemas/auth.schema.js"
import { supabase } from "../lib/supabase.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/tokens.js";
import { setAuthCookies, clearAuthCookies } from "../lib/cookies.js";
import { verifyGoogleIdToken, isGoogleSignInEnabled } from "../lib/google.js";



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

    // an account created through Google has no password_hash — there is nothing
    // to compare against, and bcrypt throws on a null hash
    const ok = user.password_hash
        ? await bcrypt.compare(data.password, user.password_hash)
        : false
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

export const googleAuthController = async (req: Request, res: Response) => {
    if (!isGoogleSignInEnabled()) {
        return res.status(501).json({
            error: {
                code: "GOOGLE_SIGNIN_DISABLED",
                message: "Google sign-in is not configured on this server",
            },
        })
    }

    const { success, error, data } = googleAuthSchema.safeParse(req.body)
    if (!success) {
        return res.status(400).json({
            error: { code: "VALIDATION_ERROR", issues: error.issues },
        })
    }

    const profile = await verifyGoogleIdToken(data.credential)
    if (!profile) {
        return res.status(401).json({
            error: { code: "INVALID_GOOGLE_TOKEN", message: "Could not verify Google sign-in" },
        })
    }

    // 1. returning Google user — matched on the stable "sub", not the email,
    //    because a Google address can be reassigned but the sub never is
    const { data: byGoogleId } = await supabase
        .from("users")
        .select("id, email, name")
        .eq("google_id", profile.googleId)
        .maybeSingle()

    if (byGoogleId) {
        const accessToken = signAccessToken(byGoogleId.id)
        const refreshToken = signRefreshToken(byGoogleId.id)
        setAuthCookies(res, accessToken, refreshToken)
        return res.status(200).json({ user: byGoogleId })
    }

    // 2. same address already registered with a password — link the two so the
    //    user keeps their existing files instead of getting a second account.
    //    Safe because we only get here for a Google-verified address.
    const { data: byEmail } = await supabase
        .from("users")
        .select("id, email, name, google_id")
        .eq("email", profile.email)
        .maybeSingle()

    if (byEmail) {
        const { data: linked, error: linkError } = await supabase
            .from("users")
            .update({
                google_id: profile.googleId,
                image_url: profile.imageUrl,
            })
            .eq("id", byEmail.id)
            .select("id, email, name")
            .single()

        if (linkError || !linked) {
            console.error("google link failed", linkError)
            return res.status(500).json({
                error: { code: "INTERNAL_ERROR", message: "Could not sign in with Google" },
            })
        }

        const accessToken = signAccessToken(linked.id)
        const refreshToken = signRefreshToken(linked.id)
        setAuthCookies(res, accessToken, refreshToken)
        return res.status(200).json({ user: linked })
    }

    // 3. brand new account — no password_hash, Google is the only way in
    const { data: created, error: insertError } = await supabase
        .from("users")
        .insert({
            email: profile.email,
            name: profile.name,
            google_id: profile.googleId,
            image_url: profile.imageUrl,
        })
        .select("id, email, name")
        .single()

    if (insertError || !created) {
        console.error("google register failed", insertError)
        return res.status(500).json({
            error: { code: "INTERNAL_ERROR", message: "Could not create account" },
        })
    }

    const accessToken = signAccessToken(created.id)
    const refreshToken = signRefreshToken(created.id)
    setAuthCookies(res, accessToken, refreshToken)

    return res.status(201).json({ user: created })
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