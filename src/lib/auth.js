/**
 * Local demo gate for the admin console.
 *
 * This is NOT authentication. It compares one build-time string so the demo
 * can show a separate admin entry point without pretending to have an account
 * system. The real path is Supabase Auth plus the `admin_users` table and RLS,
 * which arrives with the hosted milestone.
 */

export const ADMIN_DEMO_ENABLED = import.meta.env?.VITE_ADMIN_DEMO === '1'

export const ADMIN_DEMO_PASSWORD = import.meta.env?.VITE_ADMIN_DEMO_PASSWORD || ''

/**
 * @returns {{ ok: boolean, reason?: 'disabled' | 'invalid' }}
 */
export function checkAdminDemoPassword(input, options) {
  const { enabled, password } = options || {}
  if (!enabled || !password) return { ok: false, reason: 'disabled' }
  if (typeof input !== 'string' || input.length === 0) return { ok: false, reason: 'invalid' }
  return input === password ? { ok: true } : { ok: false, reason: 'invalid' }
}
