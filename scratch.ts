// scratch.ts — run with: npx tsx scratch.ts, then delete it


// to check superbase connection
{/*import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const { data, error } = await db.from('_nonexistent').select('*')
console.log({ data, error })*/}

// to check whole env
import 'dotenv/config'
function required(name: string): string(
    const value = process.env[name]
    if (!value) throw new Error(`missing required environment variables: ${name}`)
)