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
        body: JSON.stringify(telemetryPayload('psybr', 999, 64)),
      })
      .catch(() => {})
  })
  await page.route(telemetryUrl('dumangue'), (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(telemetryPayload('dumangue', 7, 256)),
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
})