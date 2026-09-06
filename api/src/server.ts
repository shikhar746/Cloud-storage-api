import { env } from './config/env.js'
import app, { webBundle } from './app.js'
import { startTrashPurgeSchedule } from './lib/purge.js'

// 0.0.0.0 rather than localhost: Render routes traffic to the container's
// external interface, and a loopback-only bind fails its port scan
app.listen(env.PORT, '0.0.0.0', () => {
    console.log(`[api] listening on port ${env.PORT} (${env.NODE_ENV})`)
    console.log(`[api] web bundle: ${webBundle ? `serving ${webBundle}` : 'not built (API only)'}`)
    console.log(`[api] allowed origins: ${env.CORS_ORIGIN.join(', ')}`)
    // the id is public — it ships in the web bundle — and printing it is the
    // quickest way to catch the two sides pointing at different OAuth clients
    console.log(`[api] google sign-in: ${env.GOOGLE_CLIENT_ID ? `enabled (${env.GOOGLE_CLIENT_ID})` : 'disabled (GOOGLE_CLIENT_ID unset)'}`)

    const sweeping = startTrashPurgeSchedule()
    console.log(
        `[api] trash purge: ${env.TRASH_RETENTION_DAYS}d retention, ` +
        (sweeping ? `sweeping every ${env.TRASH_PURGE_INTERVAL_MINUTES}m` : 'in-process sweeper off') +
        (env.PURGE_SECRET ? ', manual endpoint enabled' : ', manual endpoint disabled')
    )
})
