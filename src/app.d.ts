import type { auth } from './lib/server/auth';
import type { SupabaseClient } from '@supabase/supabase-js';
declare global {
  namespace App {
    interface Locals { user: typeof auth.$Infer.Session.user | null; session: typeof auth.$Infer.Session.session | null; supabase?: SupabaseClient }
  }
}
export {};
