import { useStore } from '../lib/store.js'
import { clockTime } from '../lib/format.js'

export default function AdminsPanel() {
  const { admins } = useStore()

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 lg:px-5">
        <p className="label-xs">Admins</p>
        <span className="num text-[12px] text-fg-dim">operator-provisioned</span>
      </div>

      {admins.length === 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          No admin accounts configured.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-[#1d2530]">
          {admins.map((admin) => (
            <li key={admin.id} className="py-3 flex items-center gap-3">
              <span className="min-w-0 text-[11px] font-semibold text-fg">
                {admin.displayName || '—'}
              </span>
              <span className="text-[10px] text-fg-dim">
                {admin.role || '—'}
              </span>
              <span className="text-[10px] text-fg-dim">
                {admin.mfa ? 'MFA' : 'no MFA'}
              </span>
              <span className="text-[10px] text-fg-dim">
                {clockTime(admin.lastLogin)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
        Admin accounts are provisioned by an operator. There is no self-service path.
      </p>
    </section>
  )
}