const UPSTREAM_URL =
  'https://hirschmilch.de/channel/ajax/refresh?build=14'
const CACHE_TTL_SECONDS = 20
const UPSTREAM_TIMEOUT_MS = 5_000
const CHANNELS = new Set(['psytrance', 'progressive', 'chillout'])
const ALLOWED_ORIGINS = new Set([
  'https://deepsignals.fm',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

type ChannelId = 'psytrance' | 'progressive' | 'chillout'

type NormalizedMetadata = {
  channelId: ChannelId
  trackId: string
  artist: string
  title: string
  source?: string
  badge?: string
  badgeDetail?: string
}

type EdgeCache = {
  match: (request: Request) => Promise<Response | undefined>
  put: (request: Request, response: Response) => Promise<void>
  delete?: (request: Request) => Promise<boolean>
}

type WorkerDependencies = {
  fetchUpstream: (
    input: string,
    init: RequestInit,
  ) => Promise<Response>
  cache: EdgeCache
}

declare const caches: { default: EdgeCache }

const DEFAULT_DEPENDENCIES: WorkerDependencies = {
  fetchUpstream: (input, init) => fetch(input, init),
  cache: {
    match: (request) => caches.default.match(request),
    put: (request, response) => caches.default.put(request, response),
    delete: (request) => caches.default.delete(request),
  },
}

function jsonResponse(
  value: unknown,
  status: number,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function applyCors(response: Response, origin: string | null) {
  const headers = new Headers(response.headers)
  headers.set('Vary', 'Origin')

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

function cacheKeyFor() {
  return new Request('https://hirschmilch-metadata-cache.internal/snapshot')
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeRecord(
  value: unknown,
  channelId: ChannelId,
): NormalizedMetadata | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const trackId =
    typeof record.trackId === 'number' && Number.isFinite(record.trackId)
      ? String(record.trackId)
      : cleanString(record.trackId)
  const artist = cleanString(record.artist)
  const title = cleanString(record.title)

  if (record.id !== channelId || !trackId || !artist || !title) {
    return null
  }

  return {
    channelId,
    trackId,
    artist,
    title,
    source: cleanString(record.source) ?? undefined,
    badge: cleanString(record.badge) ?? undefined,
    badgeDetail: cleanString(record.badgeDetail) ?? undefined,
  }
}

function isUpstreamSnapshot(value: unknown): value is Record<string, unknown>[] {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    Array.isArray(value) &&
    value.every(
      (record) =>
        record !== null &&
        typeof record === 'object' &&
        !Array.isArray(record) &&
        cleanString((record as Record<string, unknown>).id) !== null,
    )
  )
}

function metadataFromSnapshot(
  snapshot: Record<string, unknown>[],
  channelId: ChannelId,
) {
  return normalizeRecord(
    snapshot.find((record) => record.id === channelId),
    channelId,
  )
}

async function getMetadata(
  channelId: ChannelId,
  dependencies: WorkerDependencies,
) {
  const cacheKey = cacheKeyFor()
  const cached = await dependencies.cache.match(cacheKey)

  if (cached) {
    try {
      const snapshot: unknown = await cached.json()
      if (isUpstreamSnapshot(snapshot)) {
        const metadata = metadataFromSnapshot(snapshot, channelId)
        if (metadata) {
          return jsonResponse(metadata, 200, {
            'Cache-Control': 'no-store',
          })
        }

        return jsonResponse(
          { error: 'Metadata upstream returned no valid track' },
          502,
          { 'Cache-Control': 'no-store' },
        )
      }
    } catch {
      // Discard invalid cached data and fetch a validated upstream response.
    }

    await dependencies.cache.delete?.(cacheKey)
  }

  let upstream: Response

  try {
    upstream = await dependencies.fetchUpstream(UPSTREAM_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError')
    return jsonResponse(
      { error: timedOut ? 'Metadata upstream timed out' : 'Metadata upstream unavailable' },
      timedOut ? 504 : 502,
      { 'Cache-Control': 'no-store' },
    )
  }

  if (!upstream.ok) {
    return jsonResponse(
      { error: 'Metadata upstream returned an error' },
      502,
      { 'Cache-Control': 'no-store' },
    )
  }

  let upstreamData: unknown
  try {
    upstreamData = await upstream.json()
  } catch {
    return jsonResponse(
      { error: 'Metadata upstream returned invalid JSON' },
      502,
      { 'Cache-Control': 'no-store' },
    )
  }

  if (!isUpstreamSnapshot(upstreamData)) {
    return jsonResponse(
      { error: 'Metadata upstream returned an invalid response' },
      502,
      { 'Cache-Control': 'no-store' },
    )
  }

  const metadata = metadataFromSnapshot(upstreamData, channelId)

  if (!metadata) {
    return jsonResponse(
      { error: 'Metadata upstream returned no valid track' },
      502,
      { 'Cache-Control': 'no-store' },
    )
  }

  const payload = jsonResponse(upstreamData, 200, {
    'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
  })
  await dependencies.cache.put(cacheKey, payload.clone())

  return jsonResponse(metadata, 200, { 'Cache-Control': 'no-store' })
}

export async function handleRequest(
  request: Request,
  dependencies: WorkerDependencies = DEFAULT_DEPENDENCIES,
) {
  const origin = request.headers.get('Origin')

  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    })

    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers.set('Access-Control-Allow-Origin', origin)
    }

    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'GET') {
    return applyCors(
      jsonResponse(
        { error: 'Method not allowed' },
        405,
        { Allow: 'GET, OPTIONS', 'Cache-Control': 'no-store' },
      ),
      origin,
    )
  }

  const url = new URL(request.url)
  if (url.pathname !== '/metadata') {
    return applyCors(
      jsonResponse({ error: 'Not found' }, 404, {
        'Cache-Control': 'no-store',
      }),
      origin,
    )
  }

  const channelId = url.searchParams.get('channel')
  if (!channelId || !CHANNELS.has(channelId)) {
    return applyCors(
      jsonResponse({ error: 'Unsupported channel' }, 400, {
        'Cache-Control': 'no-store',
      }),
      origin,
    )
  }

  return applyCors(
    await getMetadata(channelId as ChannelId, dependencies),
    origin,
  )
}

export default {
  fetch(request: Request) {
    return handleRequest(request)
  },
}
