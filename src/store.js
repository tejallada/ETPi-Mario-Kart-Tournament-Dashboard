import { createClient } from '@supabase/supabase-js'
import { demoState } from './tournament.js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const client = url && key ? createClient(url, key) : null
export const demoStorageKey = 'etpi-tournament-v1'

export function readDemo() {
  try {
    return JSON.parse(localStorage.getItem(demoStorageKey)) ?? { state: demoState(), revision: 0 }
  } catch {
    return { state: demoState(), revision: 0 }
  }
}

export async function readTournament() {
  const { data, error } = await client.from('tournament').select('state,revision').eq('id', 1).single()
  if (error) throw error
  return data
}

export async function saveTournament(state, revision) {
  if (!client) {
    if (readDemo().revision !== revision) throw new Error('Tournament changed in another tab. Review the latest results and try again.')
    const row = { state, revision: revision + 1 }
    localStorage.setItem(demoStorageKey, JSON.stringify(row))
    return row
  }
  const { data, error } = await client.from('tournament')
    .update({ state, revision: revision + 1 }).eq('id', 1).eq('revision', revision)
    .select('state,revision').maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Your change was not saved. Check your admin access and review the latest results before retrying.')
  return data
}
