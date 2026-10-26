import { expect, test } from '../support/test'

const stations = [
  { sourceId: 'psybrazil', stationKey: 'psybr' },
  { sourceId: 'psybrazil-dumangue', stationKey: 'dumangue' },
  { sourceId: 'psybrazil-progressive', stationKey: 'progressive' },
  { sourceId: 'psybrazil-lofi', stationKey: 'lofi' },
  { sourceId: 'psybrazil-lowbpm', stationKey: 'lowbpm' },
  { sourceId: 'psybrazil-electro', stationKey: 'electro' },
] as const

function telemetryUrl(stationKey: string) {
  return `https://psybrazil.com.br/api/track.php?station=${stationKey}`
}

function telemetryPayload(stationKey: string, listeners: number, bitrate: number) {
  return {
    station: stationKey,
    status: 'online',
    listeners: { total: listeners },
    stream: {
      direct_url: `https://radio.psybrazil.com.br/${stationKey}`,
      bitrate,
    },
  }
}

function networkEntry(stationKey: string, listeners: number, bitrate: number) {
  return {
    id: stationKey,
    status: 'online',
    now_playing: `${stationKey}_Artist_-_${stationKey}_Track`,
    listeners,
    stream: {
      current: `${stationKey}_Artist_-_${stationKey}_Track`,
      mount: stationKey,
      stream_url: `https://psybrazil.com.br/${stationKey}`,
      listeners,
      bitrate,
    },
  }
}

function networkPayload() {
  return {
    ok: true,
    total_listeners: 999,
    stations: Object.fromEntries(
      ['dumangue', 'electro', 'progressive', 'planb', 'lofi', 'whapade', 'lowbpm', 'psybr']
        .map((key, index) => [key, networkEntry(key, index, 128 + index * 16)]),
    ),
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto('/player/')
})

test('all PsyBrazil channels show their own normalized telemetry', async ({
  page,
}) => {
  for (const [index, station] of stations.entries()) {
    await page.route(telemetryUrl(station.stationKey), (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(
          telemetryPayload(station.stationKey, index, 192 + index * 16),
        ),
      }),
    )
  }

  const signalSource = page.getByLabel('Signal source')
  const listenersValue = page.locator(
    '.visual-feed-window__metric--listeners .visual-feed-window__metric-value',
  )
  const bitrateValue = page.locator(
    '.visual-feed-window__metric--bitrate .visual-feed-window__metric-value',
  )

  for (const [index, station] of stations.entries()) {
    await signalSource.selectOption(station.sourceId)
    await expect(listenersValue).toHaveText(String(index))
    await expect(bitrateValue).toHaveText(String(192 + index * 16))
  }

  await signalSource.selectOption('dmt-fm')
  await expect(listenersValue).toHaveText('---')
  await expect(bitrateValue).toHaveText('---')

  await signalSource.selectOption('psybrazil-electro')
  await expect(listenersValue).toHaveText('5')
  await expect(bitrateValue).toHaveText('272')
})

test('PsyBrazil network responses supply the selected track, telemetry and artwork', async ({
  page,
}) => {
  const payload = networkPayload()
  await page.route('https://psybrazil.com.br/api/track.php?station=*', (route) =>
    route.fulfill({ json: payload }),
  )
  await page.route('https://psybrazil.com.br/api/artwork.php?*', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>',
    }),
  )

  for (const station of stations) {
    const entry = payload.stations[station.stationKey]
    await page.getByLabel('Signal source').selectOption(station.sourceId)
    await expect(page.locator('.track-marquee__live')).toHaveText(new RegExp(
      `${station.stationKey} Artist.*${station.stationKey} Track`,
    ))
    await expect(page.locator(
      '.visual-feed-window__metric--listeners .visual-feed-window__metric-value',
    )).toHaveText(String(entry.stream.listeners))
    await expect(page.locator(
      '.visual-feed-window__metric--bitrate .visual-feed-window__metric-value',
    )).toHaveText(String(entry.stream.bitrate))
    const artwork = page.locator('.visual-feed-window__artwork')
    await expect(artwork).toHaveAttribute('src', /\/api\/artwork\.php\?/)
    const artworkUrl = new URL((await artwork.getAttribute('src'))!)
    expect(artworkUrl.searchParams.get('station')).toBe(station.stationKey)
    expect(artworkUrl.searchParams.get('song')).toBe(entry.now_playing)
  }
})

test('PsyBrazil missing and offline entries never borrow another station or network totals', async ({
  page,
}) => {
  await page.clock.install()
  let payload = networkPayload()
  await page.route('https://psybrazil.com.br/api/track.php?station=*', (route) =>
    route.fulfill({ json: payload }),
  )
  await page.route('https://psybrazil.com.br/api/artwork.php?*', (route) =>
    route.abort('failed'),
  )
  const signalSource = page.getByLabel('Signal source')
  for (const station of stations) {
    for (const scenario of ['missing', 'offline', 'empty'] as const) {
      payload = networkPayload()
      await signalSource.selectOption(station.sourceId)
      await expect(page.locator('.track-marquee__live')).toHaveText(new RegExp(
        `${station.stationKey} Artist.*${station.stationKey} Track`,
      ))
      await expect(page.locator(
        '.visual-feed-window__metric--listeners .visual-feed-window__metric-value',
      )).toHaveText(String(payload.stations[station.stationKey].stream.listeners))

      if (scenario === 'missing') {
        delete payload.stations[station.stationKey]
      } else if (scenario === 'offline') {
        payload.stations[station.stationKey].status = 'offline'
      } else {
        payload.stations[station.stationKey] = {
          ...networkEntry(station.stationKey, -1, 0),
          now_playing: '',
          stream: { ...networkEntry(station.stationKey, -1, 0).stream, current: '' },
        }
      }
      await page.clock.fastForward(45_001)
      await expect(page.locator(
        '.visual-feed-window__metric--listeners .visual-feed-window__metric-value',
      )).toHaveText('---')
      await expect(page.locator(
        '.visual-feed-window__metric--bitrate .visual-feed-window__metric-value',
      )).toHaveText('---')
      await expect(page.locator('.visual-feed-window__artwork')).toHaveAttribute(
        'src', /\/images\/stations\/(?:psybr|psybrazil-[a-z]+)\.jpg$/,
      )
      await expect(page.getByText(/Artist.*Track/)).toHaveCount(0)
      await signalSource.selectOption('dmt-fm')
    }
  }
})

test('PsyBrazil station switching clears and ignores stale telemetry', async ({
  page,
}) => {
  let releasePsyBrazilResponse = () => {}
  let markPsyBrazilRequestStarted = () => {}
  const responseRelease = new Promise<void>((resolve) => {
    releasePsyBrazilResponse = resolve
  })
  const requestStarted = new Promise<void>((resolve) => {
    markPsyBrazilRequestStarted = resolve
  })

  await page.route(telemetryUrl('psybr'), async (route) => {
    markPsyBrazilRequestStarted()
    await responseRelease
    await route
      .fulfill({
        contentType: 'application/json',
        json: {
          ok: true,
          stations: { psybr: networkEntry('psybr', 999, 64) },
        },
      })
      .catch(() => {})
  })
  await page.route(telemetryUrl('dumangue'), (route) =>
    route.fulfill({
      contentType: 'application/json',
      json: {
        ok: true,
        stations: { dumangue: networkEntry('dumangue', 7, 256) },
      },
    }),
  )

  const signalSource = page.getByLabel('Signal source')
  const listenersValue = page.locator(
    '.visual-feed-window__metric--listeners .visual-feed-window__metric-value',
  )
  const bitrateValue = page.locator(
    '.visual-feed-window__metric--bitrate .visual-feed-window__metric-value',
  )

  await signalSource.selectOption('psybrazil')
  await requestStarted
  await expect(listenersValue).toHaveText('---')
  await expect(bitrateValue).toHaveText('---')

  await signalSource.selectOption('psybrazil-dumangue')
  await expect(listenersValue).toHaveText('7')
  await expect(bitrateValue).toHaveText('256')

  releasePsyBrazilResponse()
  await page.waitForTimeout(250)
  await expect(listenersValue).toHaveText('7')
  await expect(bitrateValue).toHaveText('256')
  await expect(page.locator('.track-marquee__live')).toHaveText(/dumangue Artist.*dumangue Track/)
  await expect(page.getByText(/psybr Artist.*psybr Track/)).toHaveCount(0)
})