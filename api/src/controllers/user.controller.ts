import type { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'

const emailSchema = z.email()

// Exact-address lookup only, so sharing can ask for an email instead of making
// people trade UUIDs. Deliberately no prefix or partial matching: you have to
// already know the whole address, which keeps this from being a directory dump.
export async function lookupUserController(req: Request, res: Response) {
  const raw = typeof req.query.email === 'string' ? req.query.email.toLowerCase().trim() : ''

  const { success } = emailSchema.safeParse(raw)
  if (!success) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Query parameter email must be a valid address' },
    })
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', raw)
    .maybeSingle()

  if (error) {
    console.error('user lookup failed', error)
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Lookup failed' },
    })
  }

  if (!user) {
    return res.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: 'No account with that email' },
    })
  }

  return res.status(200).json({ user })
}
