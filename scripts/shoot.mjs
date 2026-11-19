/**
 * Headless capture + console-error report over the Chrome DevTools Protocol.
 * Node 24 has global fetch and WebSocket, so this needs no dependencies.
 *
 *   node scripts/shoot.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const BASE = process.env.FW_URL || 'http://127.0.0.1:4173'
const OUT = 'shots'
const PORT = 9333
const PROFILE = 'C:/Users/shane/AppData/Local/Temp/opencode/fw-chrome'

const SHOTS = [
  { name: '01-plan', hash: '#/plan', w: 1440, h: 1080, settle: 4500 },
  { name: '02-plan-breakdown', hash: '#/plan', w: 1440, h: 1080, settle: 4500, click: 'drawer' },
  { name: '03-ledger', hash: '#/ledger', w: 1440, h: 1120, settle: 1600 },
  { name: '04-budget', hash: '#/budget', w: 1440, h: 1240, settle: 1600 },
  { name: '05-advisories', hash: '#/advisories', w: 1440, h: 1120, settle: 1400 },
  { name: '06-admin-tariff', hash: '#/admin', w: 1440, h: 1120, settle: 1400 },
  {
    name: '07-admin-moderation',
    hash: '#/admin',
    w: 1440,
    h: 1120,
    settle: 1400,
    click: 'moderation',
  },
  { name: '08-mobile-plan', hash: '#/plan', w: 390, h: 844, settle: 4200, mobile: true },
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

    await cdp.send('Page.navigate', { url: BASE + '/' + s.hash })
    await sleep(s.settle)

    if (s.click === 'drawer') {
      await cdp.send('Runtime.evaluate', {
        expression: `document.querySelector('[aria-expanded="false"]')?.click()`,
      })
      await sleep(700)
    }
    if (s.click === 'moderation') {
      await cdp.send('Runtime.evaluate', {
        expression: `[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Moderation'))?.click()`,
      })
      await sleep(600)
    }

    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      optimizeForSpeed: false,
    })
    const file = join(OUT, s.name + '.png')
    mkdirSync(OUT, { recursive: true })
    writeFileSync(file, Buffer.from(data, 'base64'))

    // surface anything the page logged
    const console_ = cdp.events
      .filter((e) => e.method === 'Runtime.consoleAPICalled')
      .map((e) => ({
        level: e.params.type,
        text: e.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '),
      }))
    const exceptions = cdp.events
      .filter((e) => e.method === 'Runtime.exceptionThrown')
      .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)
    const logErrors = cdp.events
      .filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
      .map((e) => e.params.entry.text)

    // confirm the app actually rendered something
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        nodes: document.getElementById('root')?.children.length ?? 0,
        errorBoundary: /Render error/.test(document.body.innerText||''),
        imgs: document.querySelectorAll('img.leaflet-tile').length,
        marker: document.querySelectorAll('.fw-pin').length,
        drawerExpanded: document.querySelector('[aria-expanded]')?.getAttribute('aria-expanded'),
        mapBox: (() => { const m = document.querySelector('.leaflet-container'); if(!m) return null; const r=m.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
        panelBox: (() => { const p = document.querySelector('aside'); if(!p) return null; const r=p.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })(),
        hOverflow: document.documentElement.scrollWidth > window.innerWidth,
        text: (document.body.innerText || '').replace(/\\s+/g,' ').slice(0, 1400)
      })`,
      returnByValue: true,
    })

    report.push({
      shot: s.name,
      size: `${s.w}x${s.h}`,
      page: JSON.parse(result.value),
      consoleErrors: console_.filter((c) => c.level === 'error'),
      consoleWarnings: console_.filter((c) => c.level === 'warning').slice(0, 4),
      exceptions,
      logErrors,
    })
    console.log(`shot ${s.name} (${s.w}x${s.h})`)
  }

  ws.close()
} finally {
  chrome.kill()
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))

console.log('\n================ CONSOLE REPORT ================')
for (const r of report) {
  console.log(`\n## ${r.shot}  ${r.size}`)
  const p = r.page
  console.log(
    `   dom: nodes=${p.nodes} errorBoundary=${p.errorBoundary} tiles=${p.imgs} markers=${p.marker} drawer=${p.drawerExpanded} map=${JSON.stringify(p.mapBox)} panel=${JSON.stringify(p.panelBox)} hOverflow=${p.hOverflow}`
  )
  if (r.exceptions.length) r.exceptions.forEach((e) => console.log('   EXCEPTION: ' + e))
  if (r.logErrors.length) r.logErrors.forEach((e) => console.log('   LOG-ERROR: ' + e))
  if (r.consoleErrors.length) r.consoleErrors.forEach((e) => console.log('   CONSOLE-ERR: ' + e.text))
  console.log('   text: ' + p.text)
}
console.log('\nwrote shots/report.json')
