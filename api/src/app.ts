import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import folderRoutes from './routes/folder.routes.js'
import fileRoutes from './routes/file.routes.js'
import { errorHandler } from './middleware/errorHandler.js'
import searchRoutes from "./routes/search.routes.js"
import shareRoutes from './routes/share.routes.js'
import userRoutes from './routes/user.routes.js'

const app = express()

// Render/Vercel terminate TLS in front of the app; without this Express sees
// every request as plain http and req.ip is the proxy's address
app.set('trust proxy', 1)

// An allowed origin may contain "*" as a wildcard, so a single CORS_ORIGIN
// entry can cover every Vercel preview URL (https://*.vercel.app). Matching
// walks the literal segments in order instead of building a regex, so a dot
// in a hostname is never read as "any character".
function originMatches(pattern: string, origin: string): boolean {
  if (!pattern.includes('*')) return pattern === origin

  const segments = pattern.split('*')
  const head = segments[0]!
  const tail = segments[segments.length - 1]!
  if (!origin.startsWith(head) || !origin.endsWith(tail)) return false
  // head and tail must not overlap, or "https://*.vercel.app" would accept
  // a bare "https://.vercel.app" style origin twice over
  if (head.length + tail.length > origin.length) return false

  let cursor = head.length
  const limit = origin.length - tail.length
  for (const segment of segments.slice(1, -1)) {
    const found = origin.indexOf(segment, cursor)
    if (found === -1 || found + segment.length > limit) return false
    cursor = found + segment.length
  }
  return true
}

app.use(cors({
  origin(origin, callback) {
    // no Origin header at all: curl, server-to-server, Render's health check
    if (!origin) return callback(null, true)
    // reflect the caller's own origin — a literal "*" is illegal alongside
    // credentials, and the browser needs the exact origin echoed back
    if (env.CORS_ORIGIN.some((pattern) => originMatches(pattern, origin))) return callback(null, true)
    // deny without throwing: the response simply carries no CORS headers,
    // which the browser blocks, instead of turning into a 500
    return callback(null, false)
  },
  credentials: true,   // the auth tokens ride in httpOnly cookies
}))

//--------->Auth routes<------------//

app.use(express.json())
app.use(cookieParser())
app.get('/', (_req, res) => {
    // the upload limits ride along with the health check so the web client can
    // pick its upload path from the server's numbers instead of hard-coding them
    res.json({
        status: 'ok',
        limits: {
            maxFileSizeBytes: env.MAX_FILE_SIZE_BYTES,
            maxDirectUploadBytes: env.MAX_DIRECT_UPLOAD_BYTES,
        },
    })
})
app.use('/api/auth', authRoutes)

//--------->Folder routes<------------//
app.use('/api/folders', folderRoutes)

// ---------> Files routes <--------- //
app.use("/api/files", fileRoutes)

app.use('/api/search', searchRoutes)

app.use('/api/shares', shareRoutes)

app.use('/api/users', userRoutes)

app.use((_req, res) => {
    res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
    })
})  

app.use(errorHandler)
export default app