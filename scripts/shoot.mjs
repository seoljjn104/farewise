/**
 * Headless capture + console-error report over the Chrome DevTools Protocol.
 * Node 24 has global fetch and WebSocket, so this needs no dependencies.
 *
 *   node scripts/shoot.mjs
 *
 * Set CHROME_PATH to use a different browser binary. FW_URL points the run at
 * another server (default: the local Vite preview on port 4173).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)
const CHROME = CANDIDATES.find((p) => existsSync(p))
if (!CHROME) {
  console.error('No Chrome or Edge binary found. Set CHROME_PATH.')
  process.exit(1)
}

const BASE = process.env.FW_URL || 'http://127.0.0.1:4173'
const OUT = 'shots'
const PORT = 9333
const PROFILE = process.env.FW_PROFILE || 'C:/Users/shane/AppData/Local/Temp/opencode/fw-chrome'

const SHOTS = [
  { name: '01-plan-desktop', hash: '#/plan', w: 1440, h: 900, settle: 4800 },
  {
    name: '02-plan-mobile-longnames',
    hash: '#/plan',
    w: 390,
    h: 844,
    settle: 4800,
    mobile: true,
    prep: 'longNames',
    reload: true,
  },
  { name: '03-trips-mobile', hash: '#/trips', w: 390, h: 844, settle: 1800, mobile: true },
  { name: '04-budget-mobile', hash: '#/budget', w: 390, h: 844, settle: 1800, mobile: true },
  { name: '05-alerts-mobile', hash: '#/alerts', w: 390, h: 844, settle: 1800, mobile: true },
  { name: '06-more-mobile', hash: '#/more', w: 390, h: 844, settle: 1400, mobile: true },
  {
    name: '07-admin-login',
    hash: '#/admin',
    w: 1440,
    h: 900,
    settle: 1800,
    nav: false,
    denyCheck: true,
  },
  {
    name: '08-admin-console',
    hash: '#/admin/login',
    w: 1440,
    h: 900,
    settle: 1400,
    nav: false,
    adminLogin: true,
  },
]

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.events = []
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      } else if (msg.method) {
        this.events.push(msg)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout: ${method}`))
        }
      }, 30000)
    })
  }
  evaluate(expression, returnByValue = true) {
    return this.send('Runtime.evaluate', { expression, returnByValue, awaitPromise: true })
  }
}

async function waitForPort() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) return await r.json()
    } catch {
      /* not up yet */
    }
    await sleep(250)
  }
  throw new Error('Chrome debug port never opened')
}

mkdirSync(OUT, { recursive: true })
rmSync(PROFILE, { recursive: true, force: true })

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
)

const report = []
const problems = []

try {
  await waitForPort()
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })

  const cdp = new CDP(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')

  for (const s of SHOTS) {
    cdp.events.length = 0

    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: s.w,
      height: s.h,
      deviceScaleFactor: 2,
      mobile: Boolean(s.mobile),
    })

    /* The long-name case needs a persisted state, so it is built through the
       real settings screen and then reloaded. Not a prettier screenshot. */
    if (s.prep === 'longNames') {
      await cdp.send('Page.navigate', { url: BASE + '/#/more' })
      await sleep(1600)
      await cdp.evaluate(`(() => {
        const input = document.querySelector('input[type="number"]')
        if (!input) return 'no-allowance-input'
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, '950')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return 'committed'
      })()`)
      await sleep(500)
      await cdp.evaluate(`(() => {
        const state = JSON.parse(localStorage.getItem('farewise.v2') || 'null')
        if (!state) return 'no-state'
        state.settings = {
          ...state.settings,
          homeId: 'cit',
          schoolId: 'usc',
          monthlyAllowance: 900,
        }
        localStorage.setItem('farewise.v2', JSON.stringify(state))
        return 'seeded'
      })()`)
      await sleep(200)
    }

    const url = BASE + '/' + (s.reload ? '?stress=1' : '') + s.hash
    await cdp.send('Page.navigate', { url })
    await sleep(s.settle)

    /* The gate must redirect before any console component renders. */
    if (s.denyCheck) {
      const { result } = await cdp.evaluate('window.location.hash')
      if (result.value !== '#/admin/login') {
        problems.push(`${s.name}: gate did not redirect (${result.value})`)
      }
    }

    if (s.adminLogin) {
      const password = process.env.FW_ADMIN_PASSWORD || 'farewise-demo'
      const filled = await cdp.evaluate(`(() => {
        const input = document.getElementById('admin-password')
        if (!input) return 'no-password-field'
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, ${JSON.stringify(password)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.closest('form').requestSubmit()
        return 'submitted'
      })()`)
      if (filled.result.value !== 'submitted') {
        problems.push(`${s.name}: ${filled.result.value}`)
      }
      await sleep(1800)
      const { result } = await cdp.evaluate('window.location.hash')
      if (!String(result.value).startsWith('#/admin') || result.value === '#/admin/login') {
        problems.push(`${s.name}: login did not reach the console (${result.value})`)
      }
    }

    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      optimizeForSpeed: false,
    })
    const file = join(OUT, s.name + '.png')
    mkdirSync(OUT, { recursive: true })
    writeFileSync(file, Buffer.from(data, 'base64'))

    const consoleErrors = cdp.events
      .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
      .map((e) => e.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
    const exceptions = cdp.events
      .filter((e) => e.method === 'Runtime.exceptionThrown')
      .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)
    const logErrors = cdp.events
      .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
      .map((e) => e.params.entry.text)

    const { result } = await cdp.evaluate(`JSON.stringify({
      nodes: document.getElementById('root')?.children.length ?? 0,
      errorBoundary: /Something went wrong on this screen|Render error/.test(document.body.innerText||''),
      bottomNav: (() => { const n = [...document.querySelectorAll('nav[aria-label="Primary"]')].find(x => x.getBoundingClientRect().height > 0); if (!n) return null; const r = n.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
      tabCount: (() => { const n = [...document.querySelectorAll('nav[aria-label="Primary"]')].find(x => x.getBoundingClientRect().height > 0); return n ? n.querySelectorAll('a').length : 0 })(),
      imgs: document.querySelectorAll('img.leaflet-tile').length,
      marker: document.querySelectorAll('.fw-pin').length,
      hOverflow: document.documentElement.scrollWidth > window.innerWidth,
      vh: window.innerHeight,
      text: (document.body.innerText || '').replace(/\\s+/g,' ').slice(0, 1200)
    })`)

    const page = JSON.parse(result.value)
    report.push({
      shot: s.name,
      size: `${s.w}x${s.h}`,
      page,
      consoleErrors,
      exceptions,
      logErrors,
    })

    if (page.hOverflow) problems.push(`${s.name}: horizontal overflow`)
    if (page.errorBoundary) problems.push(`${s.name}: error boundary`)
    if (page.nodes === 0) problems.push(`${s.name}: rendered nothing`)
    if (s.nav !== false && !page.bottomNav) problems.push(`${s.name}: no navigation`)
    if (s.nav !== false && page.tabCount !== 5) problems.push(`${s.name}: ${page.tabCount} tabs`)
    if (exceptions.length) problems.push(`${s.name}: ${exceptions[0]}`)
    if (consoleErrors.length) problems.push(`${s.name}: console error: ${consoleErrors[0]}`)
    if (logErrors.length) problems.push(`${s.name}: log error: ${logErrors[0]}`)

    console.log(
      `shot ${s.name} (${s.w}x${s.h}) nodes=${page.nodes} overflow=${page.hOverflow} nav=${JSON.stringify(page.bottomNav)}`
    )
  }

  ws.close()
} finally {
  chrome.kill()
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))

console.log('\n================ REPORT ================')
for (const r of report) {
  const p = r.page
  console.log(
    `\n## ${r.shot}  ${r.size}\n   nodes=${p.nodes} boundary=${p.errorBoundary} overflow=${p.hOverflow} nav=${JSON.stringify(p.bottomNav)} tabs=${p.tabCount} tiles=${p.imgs} markers=${p.marker}`
  )
  if (r.exceptions.length) r.exceptions.forEach((e) => console.log('   EXCEPTION: ' + e))
  if (r.logErrors.length) r.logErrors.forEach((e) => console.log('   LOG-ERROR: ' + e))
  if (r.consoleErrors.length) r.consoleErrors.forEach((e) => console.log('   CONSOLE-ERR: ' + e))
  console.log('   text: ' + p.text)
}

if (problems.length) {
  console.log('\n================ PROBLEMS ================')
  problems.forEach((p) => console.log(' ! ' + p))
  process.exitCode = 1
} else {
  console.log('\nAll shots clean.')
}
console.log('wrote shots/report.json')
