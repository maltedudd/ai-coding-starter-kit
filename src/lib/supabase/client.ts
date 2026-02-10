// Supabase Client for Client Components
import { createBrowserClient } from '@supabase/ssr'

// During Vercel build/prerendering, env vars may not be available.
// Provide safe fallbacks – the client won't make real API calls during SSR
// since all auth/data calls happen inside useEffect (client-side only).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
