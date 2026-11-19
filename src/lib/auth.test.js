import { describe, it, expect } from 'vitest'
import { checkAdminDemoPassword } from './auth.js'

describe('checkAdminDemoPassword', () => {
  it('accepts the configured password', () => {
    expect(checkAdminDemoPassword('secret', { enabled: true, password: 'secret' })).toEqual({
      ok: true,
    })
  })

  it('rejects a wrong password', () => {
    expect(checkAdminDemoPassword('nope', { enabled: true, password: 'secret' })).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('rejects an empty password', () => {
    expect(checkAdminDemoPassword('', { enabled: true, password: 'secret' })).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('reports the gate as disabled when the demo flag is off', () => {
    expect(checkAdminDemoPassword('secret', { enabled: false, password: 'secret' })).toEqual({
      ok: false,
      reason: 'disabled',
    })
  })

  it('reports the gate as disabled when no password is configured', () => {
    expect(checkAdminDemoPassword('secret', { enabled: true, password: undefined })).toEqual({
      ok: false,
      reason: 'disabled',
    })
  })

  it('never throws on odd input', () => {
    expect(checkAdminDemoPassword(undefined, { enabled: true, password: 'secret' }).ok).toBe(false)
    expect(checkAdminDemoPassword(null, null).ok).toBe(false)
  })
})
