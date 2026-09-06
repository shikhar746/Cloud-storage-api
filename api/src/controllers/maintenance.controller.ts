import type { Request, Response } from 'express'
import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { purgeExpiredTrash } from '../lib/purge.js'

/**
 * Lets an external scheduler drive the purge — a Render Cron Job, a GitHub
 * Actions workflow, anything that can send a header. It exists because the
 * in-process timer cannot fire while a sleeping instance is asleep.
 *
 * Guarded by a shared secret rather than a session: a cron job has no cookies.
 */
export async function purgeTrashController(req: Request, res: Response) {
  if (!env.PURGE_SECRET) {
    return res.status(501).json({
      error: {
        code: 'PURGE_DISABLED',
        message: 'Set PURGE_SECRET on the server to enable this endpoint',
      },
    })
  }

  const provided = Buffer.from(req.get('x-purge-secret') ?? '')
  const expected = Buffer.from(env.PURGE_SECRET)

  // Constant-time comparison. A plain === returns early on the first differing
  // byte, which leaks the secret one character at a time to a patient caller.
  // The length check has to come first because timingSafeEqual throws when the
  // buffers differ in length.
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid purge secret' },
    })
  }

  try {
    const purged = await purgeExpiredTrash()
    return res.status(200).json({ purged, retentionDays: env.TRASH_RETENTION_DAYS })
  } catch (err) {
    console.error('manual purge failed', err)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Purge failed' },
    })
  }
}
