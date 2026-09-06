import { OAuth2Client } from 'google-auth-library'
import { env } from '../config/env.js'

export type GoogleProfile = {
  googleId: string
  email: string
  name: string
  imageUrl: string | null
}

// one client for the process — it caches Google's signing certs between calls
const client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null

export function isGoogleSignInEnabled(): boolean {
  return client !== null
}

// verifies the ID token the browser got from Google Identity Services.
// returns null for anything we can't trust — bad signature, wrong audience,
// expired, or an address Google itself hasn't verified.
export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile | null> {
  if (!client) return null

  let payload
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID!,
    })
    payload = ticket.getPayload()
  } catch (err) {
    // by far the most common cause is the two halves being configured against
    // different OAuth clients, which the library reports only as "Wrong
    // recipient" — so name the id this process actually checks against
    const message = err instanceof Error ? err.message : String(err)
    console.error(`google id token verification failed (audience ${env.GOOGLE_CLIENT_ID}): ${message}`)
    return null
  }

  if (!payload?.sub || !payload.email) return null

  // Must be affirmatively true. A missing claim is not a confirmation, and
  // this address is what the controller matches against existing password
  // accounts — accepting an unconfirmed one would hand over that account to
  // whoever registered the address with Google.
  if (payload.email_verified !== true) {
    console.warn(`google sign-in refused: address not verified by google (${payload.email})`)
    return null
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    // name is optional in the token; fall back to the local part of the email
    name: payload.name?.trim() || payload.email.split('@')[0]!,
    imageUrl: payload.picture ?? null,
  }
}
