import 'dotenv/config'

// required (name) helper 
// throws if the values is missing
function required(name: string): string {
    const value = process.env[name]
    if (!value)
        throw new Error(`Missing required environment variable: ${name}`)
    return value
}

// optionalNumber(name, fallback)
//helper for port and max file sie bytes must reject nan
function optionalNumber(name: string, fallback: number): number {
    const value = process.env[name]
    if (!value) return fallback                    // was: value === undefined
    const n = Number(value)
    if (!Number.isInteger(n) || n <= 0)            // was: Number.isNaN(n)
        throw new Error(`Environment variable ${name} must be a positive integer, got: ${value}`)
    return n                                        // error message was empty
}
// helper for cors origin (comma separated env values)
// and return array of strings
function optionalStringArray(name: string, fallback: string[]): string[] {
    const v = process.env[name]
    return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback
}

// optionalString(name)
// helper for settings a deployment may simply not use — Google sign-in is off
// unless a client id is configured, so this returns undefined instead of throwing
function optionalString(name: string): string | undefined {
    const v = process.env[name]?.trim()
    return v ? v : undefined
}

const DURATION_UNIT_MS: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
}

// optionalDuration(name, fallback)
// helper for token TTLs, e.g. "15m", "1h", "7d" — returns both the raw
// string (for jsonwebtoken's expiresIn) and the millisecond value (for
// cookie maxAge), so the two never drift apart
function optionalDuration(name: string, fallback: string): { raw: string; ms: number } {
    const raw = process.env[name] ?? fallback
    const match = /^(\d+)(s|m|h|d)$/.exec(raw)
    if (!match)
        throw new Error(`Environment variable ${name} must look like "15m", "1h", or "7d", got: ${raw}`)
    const [, amount, unit] = match as unknown as [string, string, string]
    return { raw, ms: Number(amount) * DURATION_UNIT_MS[unit]! }
}

export const env = {
    // server
    PORT: optionalNumber('PORT', 8080),
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    CORS_ORIGIN: optionalStringArray('CORS_ORIGIN', ['http://localhost:3000']),
    // auth
    JWT_SECRET: required('JWT_SECRET'),
    REFRESH_SECRET: required('REFRESH_SECRET'),
    ACCESS_TOKEN_TTL: optionalDuration('ACCESS_TOKEN_TTL', '15m'),
    REFRESH_TOKEN_TTL: optionalDuration('REFRESH_TOKEN_TTL', '7d'),
    // google sign-in (optional — POST /api/auth/google is disabled without it)
    GOOGLE_CLIENT_ID: optionalString('GOOGLE_CLIENT_ID'),
    // supabase
    SUPABASE_URL: required('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_STORAGE_BUCKET: required('SUPABASE_STORAGE_BUCKET'),

    // uploads
    // anything at or under this goes through the API as multipart (multer buffers
    // it in memory); anything larger must use the signed-URL path straight to storage
    MAX_FILE_SIZE_BYTES: optionalNumber('MAX_FILE_SIZE_BYTES', 52_428_800),
    // ceiling for the direct-to-storage path — must not exceed the bucket's own
    // file size limit, or the signed upload is rejected by storage instead
    MAX_DIRECT_UPLOAD_BYTES: optionalNumber('MAX_DIRECT_UPLOAD_BYTES', 5_368_709_120),
} as const
