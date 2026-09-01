import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'

const app = express()

app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/', (_req, res) => {
    console.log('hello babyyyyyy i love youuuuuuuuuuuuu')
    res.json({ status: 'ok' })
})

export default app