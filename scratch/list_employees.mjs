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

async function findAndLog() {
  const { data: emps } = await supabase.from('employees').select('id, full_name')
  console.log('Employees in database:')
  emps?.forEach(e => console.log(`- ${e.full_name} (${e.id})`))
}

findAndLog()
