import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import authRoutes from './routes/auth.routes.js'
import folderRoutes from './routes/folder.routes.js'
import fileRoutes from './routes/file.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))

//--------->Auth routes<------------//

app.use(express.json())
app.use(cookieParser())
app.get('/', (_req, res) => {
    res.json({ status: 'ok' })
})
app.use('/api/auth', authRoutes)

//--------->Folder routes<------------//
app.use('/api/folders', folderRoutes)

// ---------> Files routes <--------- //
app.use("/api/files", fileRoutes)

app.use((_req, res) => {
    res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Route not found' },
    })
})  

app.use(errorHandler)
export default app