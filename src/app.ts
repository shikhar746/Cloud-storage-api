import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'

import authRoutes from './routes/auth.routes.js'
import folderRoutes from './routes/folder.routes.js'

const app = express()

//--------->Auth routes<------------//

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())
app.get('/', (_req, res) => {
    console.log('hello babyyyyyy i love youuuuuuuuuuuuu')
    res.json({ status: 'ok' })
})
app.use('/api/auth', authRoutes)

//--------->Folder routes<------------//
app.use('/api/folders', folderRoutes)

// ---------> Files routes <--------- //
app.use("/api/files", fileRoutes)


export default app