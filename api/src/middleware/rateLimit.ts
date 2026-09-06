import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'
import { env } from '../config/env.js'

/**
 * Rate limiting for the endpoints where guessing is the attack.
 *
 * Counting is per client IP. That works because `app.set('trust proxy', 1)`
 * makes Express read the single proxy hop Render puts in front of us, so the
 * address is the caller's rather than the load balancer's. Setting trust proxy
 * to `true` instead would let anyone spoof X-Forwarded-For and sidestep this
 * entirely.
 *
 * The store is in-memory, so counters are per process and reset on deploy.
 * That is adequate for a single instance and is the honest limitation: scaling
 * to several would need a shared store (Redis) to stay accurate.
 */
function limiter(code: string, message: string) {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    // Only failures count. Someone signing in correctly ten times in a row is
    // not an attack, and burning their quota would lock out the legitimate
    // case while barely inconveniencing the brute-force one.
    skipSuccessfulRequests: true,
    // the app's error envelope, so the client parses this like any other failure
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: { code, message } })
    },
  })
}

/** Sign-in, registration, and Google exchange: the password-guessing surface. */
export const authLimiter = limiter(
  'TOO_MANY_ATTEMPTS',
  'Too many attempts. Wait a few minutes and try again.'
)

/**
 * Public share links. A password-protected link is a bearer credential with a
 * short password behind it, which is exactly the shape brute force likes.
 */
export const publicShareLimiter = limiter(
  'TOO_MANY_ATTEMPTS',
  'Too many attempts for this link. Wait a few minutes and try again.'
)
