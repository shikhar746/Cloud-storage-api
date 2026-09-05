import { z } from 'zod'

export const registerSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters long").max(50, "Name must be at most 50 characters long"),
    email: z.email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters long")
        .max(72, "Password must be at most 72 characters long")
})

export const loginSchema = z.object({
    email: z.email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters long")
        .max(72, "Password must be at most 72 characters long")
})

export const googleAuthSchema = z.object({
    credential: z.string().min(1, "Missing Google credential"),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>
