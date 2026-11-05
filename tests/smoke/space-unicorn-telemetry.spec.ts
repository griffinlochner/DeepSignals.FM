import { expect, test } from '../support/test'

const statusUrl = 'https://spaceunicorn.radio/status-json.xsl'

test('Space Unicorn follows AutoDJ/live transitions and preserves unavailable listeners', async ({
  page,
}) => {
  await page.goto('/player/')
  await page.clock.install()

  const autoDJ = {
    title: 'AutoDJ Artist - AutoDJ Track',
    server_name: 'Space Unicorn Radio',
    server_description: 'Space Unicorn Radio from the Ministry of Trance 2',
    genre: 'Trance & PsyTrance',
    listenurl: 'http://spaceunicorn.radio:8000/autodj',
    listeners: 12,
    bitrate: 192,
  }
  const liveDJ = {
    ...autoDJ,
    title: 'Live Artist - Live Track',
    server_name: 'DJ Ravie Live Manchester UK',
    listenurl: 'http://spaceunicorn.radio:8000/live',
    listeners: 0,
    bitrate: 256,
  }
  let source: unknown = [autoDJ, liveDJ, {
    listenurl: 'http://spaceunicorn.radio:8000/stream',
    listeners: 0,
  }]
  let failure: 'network' | 'http' | 'json' | null = null
  await page.route(statusUrl, (route) => {
    if (failure === 'network') return route.abort('failed')
    if (failure === 'http') return route.fulfill({ status: 503, body: 'Unavailable' })
    if (failure === 'json') {
      return route.fulfill({ contentType: 'application/json', body: '{invalid' })
    }
    return route.fulfill({ json: { icestats: { source } } })
  })

  const listeners = page.locator(
    '.visual-feed-window__metric--listeners .visual-feed-window__metric-value',
  )
  const bitrate = page.locator(
    '.visual-feed-window__metric--bitrate .visual-feed-window__metric-value',
  )
  const track = page.locator('.track-marquee__live')
  await page.getByLabel('Signal source').selectOption('space-unicorn-radio')
  await expect(listeners).toHaveText('12')
  await expect(bitrate).toHaveText('192')
  await expect(track).toHaveText(autoDJ.title)

  for (const [autoListeners, liveListeners, title, count, kbps] of [
    [0, 15, liveDJ.title, '15', '256'],
    [8, 0, autoDJ.title, '8', '192'],
  ] as const) {
    source = [
      { ...autoDJ, listeners: autoListeners },
      { ...liveDJ, listeners: liveListeners },
    ]
    await page.clock.fastForward(45_001)
    await expect(listeners).toHaveText(count)
    await expect(bitrate).toHaveText(kbps)
    await expect(track).toHaveText(title)
  }

  for (const count of [undefined, 'invalid', 0]) {
    source = { ...autoDJ, listeners: count }
    await page.clock.fastForward(45_001)
    await expect(listeners).toHaveText(count === 0 ? '0' : '---')
    await expect(bitrate).toHaveText('192')
    await expect(track).toHaveText(autoDJ.title)
  }

  for (const scenario of ['network', 'http', 'json'] as const) {
    failure = scenario
    await page.clock.fastForward(45_001)
    await expect(listeners).toHaveText('---')
    await expect(bitrate).toHaveText('---')
    failure = null
    source = autoDJ
    await page.clock.fastForward(45_001)
    await expect(listeners).toHaveText('12')
    await expect(track).toHaveText(autoDJ.title)
  }
})
