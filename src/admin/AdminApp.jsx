import { useEffect } from 'react'
import { actions, useStore } from '../lib/store.js'
import { navigate } from '../lib/router.js'
import { roleById } from '../lib/fares.js'
import Icon from '../components/Icon.jsx'
import Admin from '../views/Admin.jsx'
import AdminLogin from './AdminLogin.jsx'

/**
 * The admin boundary. It owns the gate, so no console component can render
 * before the session role has been checked.
 */
export default function AdminApp({ route }) {
  const { session, admins, settings } = useStore()
  const isAdmin = session.role === 'admin'
  const isLogin = route.kind === 'adminLogin'

  useEffect(() => {
    if (!isLogin && !isAdmin) navigate('#/admin/login')
  }, [isLogin, isAdmin])

  if (isLogin) return <AdminLogin />
  if (!isAdmin) return null

  const admin = admins[0]
  const commuterRole = roleById(settings.defaultRole)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-900">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-ink-950 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#4a3c10] bg-[#2a2109] text-signal">
            <Icon name="shield" size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] leading-tight font-bold text-fg">
              FareWise admin console
            </p>
            <p className="truncate text-[11px] leading-tight text-muted">Signed in as admin</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] text-fg-dim">
            {admin?.displayName || 'Admin'}
          </span>
          <span className="hidden rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] text-muted sm:inline">
            Commuter view: {commuterRole.label}
          </span>
          <a
            href="#/"
            className="rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] font-semibold text-fg-dim hover:text-fg"
          >
            Back to commuter app
          </a>
          <button
            type="button"
            onClick={() => {
              actions.signOutAdmin()
              navigate('#/')
            }}
            className="rounded-lg border border-line bg-ink-800 px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-danger"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1">
        <Admin />
      </main>

      <footer className="shrink-0 border-t border-line px-4 py-2.5 text-center text-[10.5px] text-faint">
        Local demo. Admin accounts are provisioned by an operator. There is no self-service path.
      </footer>
    </div>
  )
}
