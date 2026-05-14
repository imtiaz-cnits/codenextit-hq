import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function update() {
  const date = '2026-05-04'
  const names = [
    { name: 'Arafat Al Siam', time: '11:00' },
    { name: 'Khandaker Fozle Rabby Shanto', time: '11:00' },
    { name: 'Soikot Ahmed', time: '15:00' },
    { name: 'Rakibuzzaman Khan Siam', time: '15:00' }
  ]

  for (const n of names) {
    const { data: emp } = await supabase.from('employees').select('id').ilike('full_name', `%${n.name}%`).maybeSingle()
    if (emp) {
      const clockIn = `${date}T${n.time}:00`
      // We need to parse it correctly to UTC if we want it to show up as local
      // Using the same logic as I added in the UI: new Date(y, m-1, d, h, m).toISOString()
      const [y, mo, d] = date.split('-').map(Number)
      const [h, mi] = n.time.split(':').map(Number)
      const iso = new Date(y, mo - 1, d, h, mi).toISOString()

      const { error } = await supabase.from('attendance').upsert({
        employee_id: emp.id,
        date: date,
        clock_in: iso
      }, { onConflict: 'employee_id,date' })
      
      if (error) console.error(`Error updating ${n.name}:`, error)
      else console.log(`Updated ${n.name} to ${n.time} (${iso})`)
    } else {
      console.log(`Employee not found: ${n.name}`)
    }
  }
}

update()
