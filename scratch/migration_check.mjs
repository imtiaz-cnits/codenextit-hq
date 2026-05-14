import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')
const envContent = fs.readFileSync(envPath, 'utf8')

const getEnv = (key) => {
  const lines = envContent.split('\n')
  for (const line of lines) {
    if (line.trim().startsWith(`${key}=`)) {
      return line.split('=')[1].trim().replace(/['"]/g, '').split('#')[0].trim()
    }
  }
  return null
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL')
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY')
const supabase = createClient(supabaseUrl, supabaseKey)

async function migrate() {
  console.log('Attempting to add office_start and office_end columns to employees table...')
  
  // We can't run ALTER TABLE via anon key. 
  // We'll try to do a dummy select to see if they exist.
  const { error } = await supabase.from('employees').select('office_start').limit(1)
  
  if (error && error.message.includes('column "office_start" does not exist')) {
    console.log('Columns are missing. Please run the following SQL in your Supabase Dashboard SQL Editor:')
    console.log(`
      ALTER TABLE employees 
      ADD COLUMN IF NOT EXISTS office_start TEXT DEFAULT '09:00',
      ADD COLUMN IF NOT EXISTS office_end TEXT DEFAULT '18:00';
    `)
  } else if (error) {
    console.error('Migration check failed:', error.message)
  } else {
    console.log('Columns already exist or could not be verified (no error).')
  }
}

migrate()
