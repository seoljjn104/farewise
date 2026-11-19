import { useState } from 'react'
import { actions } from '../lib/store.js'
import { navigate } from '../lib/router.js'
import {
  ADMIN_DEMO_ENABLED,
  ADMIN_DEMO_PASSWORD,
  checkAdminDemoPassword,
} from '../lib/auth.js'

function Mark() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#4a3c10] bg-[#2a2109]">
      <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
        <path d="M8.5 23V9h11v3.4h-7.2v2.1h6v3.4h-6V23z" fill="var(--color-signal)" />
        <circle cx="24" cy="23" r="2.3" fill="var(--color-route)" />
      </svg>
    </span>
  )
}

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(event) {
    event.preventDefault()
    const result = checkAdminDemoPassword(password, {
      enabled: ADMIN_DEMO_ENABLED,
      password: ADMIN_DEMO_PASSWORD,
    })
    if (result.ok) {
      actions.signInAdmin()
      navigate('#/admin')
      return
    }
    setError(
      result.reason === 'disabled'
        ? 'The admin console is disabled in this build.'
        : 'Those credentials were not accepted.'
    )
    setPassword('')
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-900 px-5 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center gap-3">
          <Mark />
          <div>
            <p className="text-[15px] leading-tight font-bold tracking-[-0.01em] text-fg">FareWise</p>
            <p className="text-[11px] leading-tight text-muted">Admin console</p>
          </div>
        </div>

        <div className="panel p-6">
          <h1 className="text-[19px] leading-tight font-bold tracking-[-0.015em] text-fg">
            Administrator sign in
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            This console is separate from the commuter app. Your commuter trips are never shown
            here.
          </p>

          {ADMIN_DEMO_ENABLED ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="admin-password"
                  className="mb-2 block text-[10px] font-bold tracking-[0.14em] text-muted uppercase"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  aria-invalid={error ? 'true' : undefined}
                  aria-describedby={error ? 'admin-error' : undefined}
                  className="h-11 w-full rounded-[10px] border border-line bg-ink-800 px-3 text-[14px] text-fg"
                />
              </div>

              {error && (
                <p
                  id="admin-error"
                  role="alert"
                  className="rounded-[9px] border border-[#5a2a2a] bg-danger-dim px-3 py-2 text-[12px] text-danger"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="h-11 w-full rounded-[10px] bg-signal px-4 text-[13.5px] font-bold text-signal-ink transition-colors hover:bg-[#ffd05c]"
              >
                Sign in
              </button>
            </form>
          ) : (
            <p className="mt-6 rounded-[9px] border border-line bg-ink-800 px-3 py-3 text-[12px] leading-relaxed text-muted">
              The admin console is disabled in this build. Enable the demo flag to sign in.
            </p>
          )}
        </div>

        <a
          href="#/"
          className="mt-5 flex items-center justify-center gap-2 text-[12px] font-semibold text-muted hover:text-fg"
        >
          Back to the commuter app
        </a>
      </div>
    </div>
  )
}
