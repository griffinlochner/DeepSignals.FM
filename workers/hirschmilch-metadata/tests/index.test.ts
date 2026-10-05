import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleRequest } from '../src/index.ts'

type Cache = {
  values: Map<string, Response>
  match: (request: Request) => Promise<Response | undefined>
  put: (request: Request, response: Response) => Promise<void>
  delete: (request: Request) => Promise<boolean>
}

function makeCache(): Cache {
  const values = new Map<string, Response>()
  return {
    values,
    async match(request) {
      const response = values.get(request.url)
      if (!response) return undefined
      const maxAge = Number(
        response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1] ?? 0,
      )
      if (maxAge <= 0) {
        values.delete(request.url)
        return undefined
      }
      return response.clone()
    },
    async put(request, response) {
      values.set(request.url, response.clone())
    },
    async delete(request) {
      return values.delete(request.url)
    },
  }
}

const upstreamRecords = [
  {
    id: 'psytrance',
    trackId: 36350,
    artist: 'Serenity Flux',
    title: 'Hazeman (Original Mix)',
    source: 'channel',
    badge: 'Live',
    badgeDetail: '',
    image: '/images/artist/not-forwarded.webp',
  },
  {
    id: 'progressive',
    trackId: 12659,
    artist: 'Agent Kritsek & Sensogram',
    title: 'Turn On',
  },
  {
    id: 'chillout',
    trackId: 14699,
    artist: 'From Vacuum',
    title: 'Dream',
  },
]

function request(
  channel = 'psytrance',
  origin = 'https://deepsignals.fm',
  method = 'GET',
  path = '/metadata',
) {
  return new Request(
    `https://hirschmilch-metadata.workers.dev${path}?channel=${channel}`,
    { method, headers: origin ? { Origin: origin } : {} },
  )
}

function dependencies(
  fetchUpstream: (input: string, init: RequestInit) => Promise<Response>,
  cache = makeCache(),
) {
  return {
    cache,
    fetchUpstream,
  }
}

test('returns normalized metadata and does not pass through artwork URLs', async () => {
  const response = await handleRequest(
    request(),
    dependencies(async () => Response.json(upstreamRecords)),
  )

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://deepsignals.fm')
  assert.equal(response.headers.get('Vary'), 'Origin')
  assert.deepEqual(await response.json(), {
    channelId: 'psytrance',
    trackId: '36350',
    artist: 'Serenity Flux',
    title: 'Hazeman (Original Mix)',
    source: 'channel',
    badge: 'Live',
  })
})

test('normalizes all approved channel IDs from the upstream response', async () => {
  for (const channel of ['psytrance', 'progressive', 'chillout']) {
    const response = await handleRequest(
      request(channel),
      dependencies(async () => Response.json(upstreamRecords)),
    )
    assert.equal(response.status, 200)
    assert.equal((await response.json() as { channelId: string }).channelId, channel)
  }
})

test('rejects unsupported channels without calling upstream', async () => {
  let calls = 0
  const response = await handleRequest(
    request('electronic'),
    dependencies(async () => {
      calls += 1
      return Response.json(upstreamRecords)
    }),
  )

  assert.equal(response.status, 400)
  assert.equal(calls, 0)
})

test('allows production and local origins with matching CORS headers', async () => {
  for (const origin of [
    'https://deepsignals.fm',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]) {
    const response = await handleRequest(
      request('psytrance', origin),
      dependencies(async () => Response.json(upstreamRecords)),
    )
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin)
  }
})

test('does not allow an unrelated origin', async () => {
  const response = await handleRequest(
    request('psytrance', 'https://attacker.example'),
    dependencies(async () => Response.json(upstreamRecords)),
  )

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(response.headers.get('Vary'), 'Origin')
})

test('supports OPTIONS preflight without fetching upstream', async () => {
  let calls = 0
  const response = await handleRequest(
    request('', 'http://localhost:5173', 'OPTIONS'),
    dependencies(async () => {
      calls += 1
      return Response.json(upstreamRecords)
    }),
  )

  assert.equal(response.status, 204)
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173')
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS')
  assert.equal(calls, 0)
})

test('rejects unsupported methods and paths', async () => {
  const methodResponse = await handleRequest(
    request('psytrance', '', 'POST'),
    dependencies(async () => Response.json(upstreamRecords)),
  )
  const pathResponse = await handleRequest(
    request('psytrance', '', 'GET', '/audio'),
    dependencies(async () => Response.json(upstreamRecords)),
  )

  assert.equal(methodResponse.status, 405)
  assert.equal(methodResponse.headers.get('Allow'), 'GET, OPTIONS')
  assert.equal(pathResponse.status, 404)
})

test('reuses cached valid metadata for 20 seconds', async () => {
  const cache = makeCache()
  let calls = 0
  const deps = dependencies(async () => {
    calls += 1
    return Response.json(upstreamRecords)
  }, cache)

  const first = await handleRequest(request(), deps)
  const second = await handleRequest(request(), deps)

  assert.equal(first.status, 200)
  assert.equal(second.status, 200)
  assert.equal(calls, 1)
  assert.equal([...cache.values.values()][0].headers.get('Cache-Control'), 'public, max-age=20')
})

test('shares one cached upstream snapshot across all approved channel requests', async () => {
  const cache = makeCache()
  let calls = 0
  const deps = dependencies(async () => {
    calls += 1
    return Response.json(upstreamRecords)
  }, cache)

  const psytrance = await handleRequest(request('psytrance'), deps)
  const progressive = await handleRequest(request('progressive'), deps)
  const chillout = await handleRequest(request('chillout'), deps)

  assert.equal(psytrance.status, 200)
  assert.equal((await psytrance.json() as { channelId: string }).channelId, 'psytrance')
  assert.equal(progressive.status, 200)
  assert.equal((await progressive.json() as { channelId: string }).channelId, 'progressive')
  assert.equal(chillout.status, 200)
  assert.equal((await chillout.json() as { channelId: string }).channelId, 'chillout')
  assert.equal(calls, 1)
  assert.equal(cache.values.size, 1)
  assert.deepEqual(
    await [...cache.values.values()][0].clone().json(),
    upstreamRecords,
  )
  assert.equal(
    [...cache.values.values()][0].headers.get('Cache-Control'),
    'public, max-age=20',
  )
})

test('does not cache upstream HTTP errors or network failures', async () => {
  const cache = makeCache()
  const errorResponse = await handleRequest(
    request(),
    dependencies(async () => new Response('unavailable', { status: 503 }), cache),
  )
  const networkResponse = await handleRequest(
    request(),
    dependencies(async () => {
      throw new TypeError('network down')
    }, cache),
  )

  assert.equal(errorResponse.status, 502)
  assert.equal(networkResponse.status, 502)
  assert.equal(cache.values.size, 0)
})

test('returns 504 on timeout and does not cache', async () => {
  const cache = makeCache()
  const response = await handleRequest(
    request(),
    dependencies(async (_input, init) => {
      const signal = init.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(signal.reason),
          { once: true },
        )
      })
    }, cache),
  )

  assert.equal(response.status, 504)
  assert.equal(cache.values.size, 0)
})

test('does not cache malformed JSON or blank metadata', async () => {
  const cache = makeCache()
  const malformed = await handleRequest(
    request(),
    dependencies(async () => new Response('not-json'), cache),
  )
  const blank = await handleRequest(
    request(),
    dependencies(
      async () =>
        Response.json([
          { id: 'psytrance', trackId: 36350, artist: ' ', title: '' },
        ]),
      cache,
    ),
  )

  assert.equal(malformed.status, 502)
  assert.equal(blank.status, 502)
  assert.equal(cache.values.size, 0)
})

test('uses a fixed upstream URL and a five-second timeout', async () => {
  let calledUrl = ''
  let timeout = 0
  await handleRequest(
    request(),
    dependencies(async (input, init) => {
      calledUrl = input
      timeout = (init.signal as AbortSignal).aborted ? 0 : 5_000
      return Response.json(upstreamRecords)
    }),
  )

  assert.equal(
    calledUrl,
    'https://hirschmilch.de/channel/ajax/refresh?build=14',
  )
  assert.equal(timeout, 5_000)
})
