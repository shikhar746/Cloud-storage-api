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
    console.error('google id token verification failed', err)
    return null
  }

  if (!payload?.sub || !payload.email) return null

  // an unverified address could belong to anyone — never link an account to it
  if (payload.email_verified === false) return null

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase().trim(),
    // name is optional in the token; fall back to the local part of the email
    name: payload.name?.trim() || payload.email.split('@')[0]!,
    imageUrl: payload.picture ?? null,
  }
}
