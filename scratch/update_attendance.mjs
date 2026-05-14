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
    if (line.startsWith(`${key}=`)) {
      return line.split('=')[1].trim().replace(/['"]/g, '').split('#')[0].trim()
    }
  }
  return null
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL')
const supabaseKey = getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || getEnv('SUPABASE_PUBLISHABLE_KEY')

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in .env')
  console.log('Keys checked: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function update() {
  const date = '2026-05-04'
  const names = [
    { name: 'Arafat Al Siam', time: '11:00' },
    { name: 'Khandaker Fozle Rabby Shanto', time: '11:00' },
    { name: 'Soikot Ahmed', time: '15:00' },
    { name: 'Rakibuzzaman Khan Siam', time: '15:00' }
  ]

  console.log(`Starting update for ${date}...`)

  for (const n of names) {
    console.log(`Searching for ${n.name}...`)
    const { data: emp } = await supabase.from('employees').select('id, full_name').ilike('full_name', `%${n.name}%`).maybeSingle()
    if (emp) {
      console.log(`Found ${emp.full_name} (${emp.id})`)
      const [y, mo, d] = date.split('-').map(Number)
      const [h, mi] = n.time.split(':').map(Number)
      const iso = new Date(y, mo - 1, d, h, mi).toISOString()

      const { data: existing } = await supabase.from('attendance')
        .select('id')
        .eq('employee_id', emp.id)
        .eq('date', date)
        .maybeSingle()

      const updateData = {
        employee_id: emp.id,
        date: date,
        clock_in: iso
      }
      if (existing) updateData.id = existing.id

      const { error } = await supabase.from('attendance').upsert(updateData)
      
      if (error) console.error(`Error updating ${n.name}:`, error)
      else console.log(`Updated ${n.name} to ${n.time} (UTC: ${iso})`)
    } else {
      console.log(`Employee not found matching: ${n.name}`)
    }
  }
  console.log('Done.')
}

update()
