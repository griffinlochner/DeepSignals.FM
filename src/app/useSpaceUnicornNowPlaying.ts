import { useEffect, useRef, useState } from 'react'
import {
  useExternalNowPlaying,
  type ExternalNowPlayingMetadata,
} from './useExternalNowPlaying'

const SPACE_UNICORN_SOURCE_ID = 'space-unicorn-radio'
const SPACE_UNICORN_NOW_PLAYING_URL = 'https://spaceunicorn.radio/status-json.xsl'
const SPACE_UNICORN_METADATA_POLL_MS = 20_000
const SPACE_UNICORN_TELEMETRY_POLL_MS = 45_000

export type StationTelemetry = {
  listeners: number | null
  bitrateKbps: number | null
}

type SpaceUnicornSourceEntry = {
  title?: unknown
  server_name?: unknown
  server_description?: unknown
  genre?: unknown
  listeners?: unknown
  bitrate?: unknown
  audio_info?: unknown
  listenurl?: unknown
  server_type?: unknown
  stream_start?: unknown
  dummy?: unknown
  [key: string]: unknown
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parseNumericString(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function parseNonNegativeInteger(value: unknown): number | null {
  const parsed = parseNumericString(value)

  if (parsed === null || parsed < 0 || !Number.isFinite(parsed)) {
    return null
  }

  return Math.trunc(parsed)
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseNumericString(value)

  if (parsed === null || parsed <= 0 || !Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function parseBitrateFromAudioInfo(value: unknown): number | null {
  const audioInfo = cleanString(value)

  if (!audioInfo) {
    return null
  }

  const match = audioInfo.match(/(?:^|[\s,;])bitrate\s*=\s*(\d+(?:\.\d+)?)/i)

  if (!match?.[1]) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function pickTelemetrySource(value: unknown): SpaceUnicornSourceEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const root = value as {
    icestats?: {
      source?: unknown
    }
  }

  const rawSources = Array.isArray(root.icestats?.source)
    ? root.icestats.source
    : root.icestats?.source
      ? [root.icestats.source]
      : []

  let bestSource: { source: SpaceUnicornSourceEntry; score: number } | null = null

  for (const candidate of rawSources) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const source = candidate as SpaceUnicornSourceEntry
    const listenUrl = cleanString(source.listenurl)
    const serverName = cleanString(source.server_name)
    const serverDescription = cleanString(source.server_description)
    const title = cleanString(source.title)
    const hasSpaceUnicornIdentity =
      !!(serverName && /space unicorn/i.test(serverName)) ||
      !!(listenUrl && /spaceunicorn\.radio/i.test(listenUrl)) ||
      !!(serverDescription && /space unicorn/i.test(serverDescription))

    if (!hasSpaceUnicornIdentity && !title && !serverName && !serverDescription) {
      continue
    }

    let score = 0

    if (serverName && /space unicorn/i.test(serverName)) {
      score += 100
    }
    if (listenUrl && /spaceunicorn\.radio/i.test(listenUrl)) {
      score += 60
    }
    if (listenUrl && /\/(autodj|live|stream)(\/|$)/i.test(listenUrl)) {
      score += 20
    }
    if (title) {
      score += 20
    }
    if (serverDescription) {
      score += 10
    }
    if (source.listeners !== undefined) {
      score += 5
    }
    if (source.bitrate !== undefined || source.audio_info !== undefined) {
      score += 5
    }

    if (!bestSource || score > bestSource.score) {
      bestSource = { source, score }
    }
  }

  return bestSource?.source ?? null
}

export function parseSpaceUnicornTelemetry(value: unknown): StationTelemetry | null {
  const source = pickTelemetrySource(value)

  if (!source) {
    return null
  }

  const listeners = parseNonNegativeInteger(source.listeners)
  const bitrateFromField = parsePositiveNumber(source.bitrate)
  const bitrateFromAudioInfo = parseBitrateFromAudioInfo(source.audio_info)
  const bitrateKbps = bitrateFromField ?? bitrateFromAudioInfo

  return {
    listeners,
    bitrateKbps,
  }
}

function pickMeaningfulSource(value: unknown): SpaceUnicornSourceEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const root = value as {
    icestats?: {
      source?: unknown
    }
  }

  const rawSources = Array.isArray(root.icestats?.source)
    ? root.icestats.source
    : root.icestats?.source
      ? [root.icestats.source]
      : []

  let bestSource: { source: SpaceUnicornSourceEntry; score: number } | null = null

  for (const candidate of rawSources) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const source = candidate as SpaceUnicornSourceEntry
    const title = cleanString(source.title)
    const serverName = cleanString(source.server_name)
    const serverDescription = cleanString(source.server_description)
    const genre = cleanString(source.genre)
    const listenUrl = cleanString(source.listenurl)

    if (!title && !serverName && !serverDescription && !genre) {
      continue
    }

    const listenersValue =
      typeof source.listeners === 'number'
        ? source.listeners
        : Number(source.listeners)
    const listeners = Number.isFinite(listenersValue) ? listenersValue : 0

    let score = 0

    if (title) {
      score += 100
    }
    if (serverName) {
      score += 30
    }
    if (genre) {
      score += 10
    }
    if (serverDescription) {
      score += 8
    }
    if (listenUrl && /\/(autodj|live|stream)(\/|$)/i.test(listenUrl)) {
      score += 15
    }
    if (Number.isFinite(listenersValue)) {
      score += listeners
    }

    if (!bestSource || score > bestSource.score) {
      bestSource = { source, score }
    }
  }

  return bestSource?.source ?? null
}

function parseSpaceUnicornNowPlaying(value: unknown): ExternalNowPlayingMetadata | null {
  const activeSource = pickMeaningfulSource(value)

  if (!activeSource) {
    return null
  }

  const title =
    cleanString(activeSource.title) ??
    cleanString(activeSource.server_name) ??
    cleanString(activeSource.server_description)

  if (!title) {
    return null
  }

  const genre = cleanString(activeSource.genre) ?? undefined
  const listenUrl = cleanString(activeSource.listenurl) ?? undefined
  const serverName = cleanString(activeSource.server_name) ?? undefined
  const bitrate =
    typeof activeSource.bitrate === 'number'
      ? String(activeSource.bitrate)
      : cleanString(activeSource.bitrate) ?? undefined

  const changeKey = [title, serverName, genre, listenUrl, bitrate]
    .filter((part) => !!part)
    .join(':')

  return {
    sourceUrl: SPACE_UNICORN_NOW_PLAYING_URL,
    title,
    genre,
    origin: 'configured',
    changeKey,
  }
}

const SPACE_UNICORN_NOW_PLAYING_CONFIG = {
  sourceId: SPACE_UNICORN_SOURCE_ID,
  nowPlayingUrl: SPACE_UNICORN_NOW_PLAYING_URL,
  pollMs: SPACE_UNICORN_METADATA_POLL_MS,
  fetchResponseType: 'json' as const,
  parse: parseSpaceUnicornNowPlaying,
}

export function useSpaceUnicornNowPlaying(selectedSourceId: string | null) {
  return useExternalNowPlaying(selectedSourceId, SPACE_UNICORN_NOW_PLAYING_CONFIG)
}

export function useSpaceUnicornTelemetry(selectedSourceId: string | null) {
  const [telemetry, setTelemetry] = useState<StationTelemetry | null>(null)
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    requestGenerationRef.current += 1
    const generation = requestGenerationRef.current

    if (selectedSourceId !== SPACE_UNICORN_SOURCE_ID) {
      return
    }

    let timeoutHandle: number | null = null
    let activeController: AbortController | null = null

    const poll = async () => {
      activeController = new AbortController()

      try {
        const response = await fetch(SPACE_UNICORN_NOW_PLAYING_URL, {
          cache: 'no-store',
          mode: 'cors',
          signal: activeController.signal,
        })

        if (!response.ok) {
          throw new Error(
            `Space Unicorn telemetry request failed (${response.status})`,
          )
        }

        const payload = await response.json()
        const nextTelemetry = parseSpaceUnicornTelemetry(payload)

        if (requestGenerationRef.current !== generation) {
          return
        }

        setTelemetry((current) => {
          if (
            current?.listeners === nextTelemetry?.listeners &&
            current?.bitrateKbps === nextTelemetry?.bitrateKbps
          ) {
            return current
          }

          return nextTelemetry
        })
      } catch {
        if (
          activeController?.signal.aborted ||
          requestGenerationRef.current !== generation
        ) {
          return
        }

        setTelemetry(null)
      } finally {
        if (requestGenerationRef.current === generation) {
          timeoutHandle = window.setTimeout(poll, SPACE_UNICORN_TELEMETRY_POLL_MS)
        }
      }
    }

    void poll()

    return () => {
      requestGenerationRef.current += 1
      activeController?.abort()
      setTelemetry(null)

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [selectedSourceId])

  return selectedSourceId === SPACE_UNICORN_SOURCE_ID ? telemetry : null
}

export default useSpaceUnicornTelemetry
