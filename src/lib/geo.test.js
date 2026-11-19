import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchRoute } from './geo.js'

const a = { lat: 10.29, lng: 123.88 }
const b = { lat: 10.33, lng: 123.9 }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchRoute', () => {
  it('falls back to an offline estimate when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      })
    )
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const route = await fetchRoute([a, b])
    expect(route.source).toBe('estimate')
    expect(route.legs).toHaveLength(1)
    expect(route.legs[0].km).toBeGreaterThan(0)
    expect(route.path).toHaveLength(2)
    expect(route.km).toBeGreaterThan(0)
    expect(route.min).toBeGreaterThan(0)
  })

  it('reads legs, distance, and geometry from a real OSRM payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          routes: [
            {
              distance: 3000,
              duration: 600,
              legs: [
                { distance: 1800, duration: 400 },
                { distance: 1200, duration: 200 },
              ],
              geometry: {
                coordinates: [
                  [123.88, 10.29],
                  [123.9, 10.33],
                ],
              },
            },
          ],
        }),
      }))
    )

    const route = await fetchRoute([a, b])
    expect(route.source).toBe('osrm')
    expect(route.legs).toEqual([
      { km: 1.8, min: 6.7 },
      { km: 1.2, min: 3.3 },
    ])
    expect(route.path).toEqual([
      [10.29, 123.88],
      [10.33, 123.9],
    ])
    expect(route.km).toBe(3)
    expect(route.min).toBe(10)
  })
})
