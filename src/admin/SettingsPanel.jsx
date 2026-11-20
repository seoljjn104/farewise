import { useEffect, useState } from 'react'
import { actions } from '../lib/store.js'
import { isoDay } from '../lib/format.js'
import { Btn } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'

/**
 * Admin settings panel.
 * - Appearance (dark / light mode) toggling
 * - Data backup / reset actions
 */
export default function SettingsPanel() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('farewise-theme')
    return saved || 'light'
  })
  const [notice, setNotice] = useState(null)

  // Apply theme to html element
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      localStorage.setItem('farewise-theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('farewise-theme', 'light')
    }
  }, [theme])

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ session: undefined })],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `farewise-backup-${isoDay(new Date())}.json`
    a.click()
    URL.revokeObjectURL(url)
    setNotice({ ok: true, text: 'Backup exported.' })
  }

  function resetData() {
    if (confirm('Reset all local demo data? This cannot be undone.')) {
      actions.resetAll()
      setNotice({ ok: true, text: 'Demo data reset.' })
    }
  }

  return (
    <div className="p-4 lg:p-5">
      {/* ---------------------------------------------------------- appearance */}
      <div className="mb-4">
        <h2 className="text-[13.5px] font-bold text-fg mb-3">Appearance</h2>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="theme"
            value="light"
            checked={theme === 'light'}
            onChange={() => toggleTheme()}
            className="rounded w-4 h-4 border border-fg-200 bg-faint cursor-pointer"
          />
          <span className="text-[12px] leading-relaxed text-fg">Light</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="theme"
            value="dark"
            checked={theme === 'dark'}
            onChange={() => toggleTheme()}
            className="rounded w-4 h-4 border border-fg-200 bg-faint cursor-pointer"
          />
          <span className="text-[12px] leading-relaxed text-faint">Dark</span>
        </label>
      </div>

      {/* ---------------------------------------------------------- data */}
      <div>
        <h2 className="text-[13.5px] font-bold text-fg mb-3">Data</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Btn icon="download" onClick={exportData} className="w-full sm:w-auto">
            Export JSON backup
          </Btn>
          <Btn icon="upload" onClick={() => document.querySelector('input[type="file"]').click()} className="w-full sm:w-auto">
            Import JSON backup
          </Btn>
        </div>
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const reader = new FileReader()
              reader.onload = (e) => {
                try {
                  const parsed = JSON.parse(e.target.result)
                  const result = actions.importState(parsed)
                  setNotice(
                    result.ok
                      ? { ok: true, text: result.message }
                      : { ok: false, text: result.message }
                  )
                } catch {
                  setNotice({ ok: false, text: 'Invalid JSON file.' })
                }
              }
              reader.readAsText(file)
            } catch {
              setNotice({ ok: false, text: 'Error reading file.' })
            }
          }}
        />
        <p className="text-[10.5px] leading-relaxed text-faint mt-2">
          Importing replaces trips, advisories, and settings. A file that does not parse
          leaves everything as it was.
        </p>
      </div>

      {/* ---------------------------------------------------------- danger */}
      <section className="mt-4 border-t border-line pt-4">
        <h2 className="text-[13.5px] font-bold text-danger mb-3">Danger zone</h2>
        <p className="text-[11px] leading-relaxed text-muted">
          Reset returns every setting, trip, and advisory to the seeded demo. It cannot be undone.
        </p>
        <Btn variant="danger" icon="trash" onClick={resetData} className="w-full">
          Reset demo data
        </Btn>
      </section>

      {notice && (
        <p
          role="status"
          className={
            'mt-3 flex items-start gap-2 rounded-[10px] border px-3 py-2 text-[11.5px] leading-relaxed ' +
            (notice.ok ? 'border-[#1f4a36] bg-route-dim text-route' : 'border-[#5a2a2a] bg-danger-dim text-danger')
          }
        >
          <Icon name={notice.ok ? 'check' : 'alert'} size={13} className="mt-px shrink-0" />
          {notice.text}
        </p>
      )}
    </div>
  )
}