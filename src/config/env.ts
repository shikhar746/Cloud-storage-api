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

export const env = {
    // server
    PORT: optionalNumber('PORT', 8080),
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    CORS_ORIGIN: optionalStringArray('CORS_ORIGIN', ['http://localhost:3000']),
    // auth
    JWT_SECRET: required('JWT_SECRET'),
    REFRESH_SECRET: required('REFRESH_SECRET'),
    // supabase
    SUPABASE_URL: required('SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_STORAGE_BUCKET: required('SUPABASE_STORAGE_BUCKET'),

    // uploads
    MAX_FILE_SIZE_BYTES: optionalNumber('MAX_FILE_SIZE_BYTES', 52_428_800),
} as const
