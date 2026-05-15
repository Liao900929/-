import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Mock client falls back gracefully so localStorage takes over
function createMockClient() {
  const noopResult = { data: null, error: 'Supabase not configured' }
  function selectBuilder() {
    const p = Promise.resolve(noopResult)
    p.order = () => Promise.resolve(noopResult)
    return p
  }
  return {
    from: (_table) => ({
      select: selectBuilder,
      upsert: (_data) => Promise.resolve({ error: 'Supabase not configured' }),
      delete: () => ({ in: (_col, _vals) => Promise.resolve({ error: 'Supabase not configured' }) }),
    }),
  }
}

export const supabase = (url && key) ? createClient(url, key) : createMockClient()
