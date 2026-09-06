import { env } from './config/env.js'
import app from './app.js'

// 0.0.0.0 rather than localhost: Render routes traffic to the container's
// external interface, and a loopback-only bind fails its port scan
app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[api] listening on port ${env.PORT} (${env.NODE_ENV})`)
    console.log(`[api] allowed origins: ${env.CORS_ORIGIN.join(', ')}`)
    console.log(`[api] google sign-in: ${env.GOOGLE_CLIENT_ID ? 'enabled' : 'disabled (GOOGLE_CLIENT_ID unset)'}`)
})
