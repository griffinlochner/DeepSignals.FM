import { useEffect, useMemo, useRef, useState } from 'react'
import type { AudioSource } from './playerTypes'
import {
  createConfiguredTrackSignalMetadata,
  type TrackSignalMetadata,
} from './trackSignalMetadata'

type TrackSignalMetadataStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unsupported-source'

type UseTrackSignalMetadataResult = {
  status: TrackSignalMetadataStatus
  metadata: TrackSignalMetadata | null
  errorMessage: string | null
}

type MetadataCacheEntry = {
  metadata: TrackSignalMetadata
  errorMessage: string | null
}

const metadataCache = new Map<string, MetadataCacheEntry>()
const inFlightByUrl = new Map<string, Promise<MetadataCacheEntry>>()
let cleanupRegistered = false

function sanitizeText(value: string | undefined | null) {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function extractYear(value: string | undefined | null) {
  const cleaned = sanitizeText(value)

  if (!cleaned) {
    return undefined
  }

  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/)
  return yearMatch?.[0]
}

function deriveMetadataFromEntry(entry: MetadataCacheEntry): UseTrackSignalMetadataResult {
  return {
    status: entry.errorMessage ? 'error' : 'ready',
    metadata: entry.metadata,
    errorMessage: entry.errorMessage,
  }
}

function registerCacheCleanup() {
  if (cleanupRegistered || typeof window === 'undefined') {
    return
  }

  const handleBeforeUnload = () => {
    metadataCache.forEach((entry) => {
      if (entry.metadata.artworkUrl) {
        URL.revokeObjectURL(entry.metadata.artworkUrl)
      }
    })
  }

  window.addEventListener('beforeunload', handleBeforeUnload)
  cleanupRegistered = true
}

async function parseTrackSignalMetadata(
  source: AudioSource,
  signal: AbortSignal,
): Promise<MetadataCacheEntry> {
  const configuredMetadata = createConfiguredTrackSignalMetadata(source)

  const response = await fetch(source.audioUrl, {
    signal,
    cache: 'force-cache',
  })

  if (!response.ok) {
    throw new Error(`Track metadata fetch failed (${response.status})`)
  }

  const blob = await response.blob()
  const { parseBlob } = await import('music-metadata')
  const parsed = await parseBlob(blob)
  const common = parsed.common

  const embeddedTitle = sanitizeText(common.title)
  const embeddedArtist = sanitizeText(common.artist)
  const embeddedAlbum = sanitizeText(common.album)
  const embeddedYear =
    common.year && Number.isFinite(common.year)
      ? `${common.year}`
      : extractYear(common.date)

  const picture = common.picture?.find(
    (candidate) => candidate.data.length > 0,
  )

  let artworkUrl: string | undefined
  let artworkMimeType: string | undefined

  if (picture) {
    artworkMimeType = sanitizeText(picture.format) ?? 'image/jpeg'
    const artworkBytes = Uint8Array.from(picture.data)
    artworkUrl = URL.createObjectURL(
      new Blob([artworkBytes], { type: artworkMimeType }),
    )
  }

  const hasEmbeddedSignal =
    Boolean(embeddedTitle) ||
    Boolean(embeddedArtist) ||
    Boolean(embeddedAlbum) ||
    Boolean(embeddedYear) ||
    Boolean(artworkUrl)

  const metadata: TrackSignalMetadata = {
    sourceUrl: source.audioUrl,
    title: embeddedTitle ?? configuredMetadata.title,
    artist: embeddedArtist ?? configuredMetadata.artist,
    album: embeddedAlbum,
    year: embeddedYear,
    artworkUrl,
    artworkMimeType,
    origin: hasEmbeddedSignal ? 'embedded' : 'configured',
  }

  return {
    metadata,
    errorMessage: null,
  }
}

async function loadTrackSignalMetadata(
  source: AudioSource,
  signal: AbortSignal,
): Promise<MetadataCacheEntry> {
  const cached = metadataCache.get(source.audioUrl)

  if (cached) {
    return cached
  }

  const existingInFlight = inFlightByUrl.get(source.audioUrl)

  if (existingInFlight) {
    return existingInFlight
  }

  const requestPromise = parseTrackSignalMetadata(source, signal)
    .then((entry) => {
      registerCacheCleanup()
      const previous = metadataCache.get(source.audioUrl)

      if (
        previous?.metadata.artworkUrl &&
        previous.metadata.artworkUrl !== entry.metadata.artworkUrl
      ) {
        URL.revokeObjectURL(previous.metadata.artworkUrl)
      }

      metadataCache.set(source.audioUrl, entry)
      return entry
    })
    .catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error
      }

      const fallbackEntry: MetadataCacheEntry = {
        metadata: createConfiguredTrackSignalMetadata(source),
        errorMessage: 'Embedded track data unavailable',
      }

      metadataCache.set(source.audioUrl, fallbackEntry)
      console.warn('Signal Feed metadata parse unavailable for track', {
        sourceUrl: source.audioUrl,
        error,
      })
      return fallbackEntry
    })
    .finally(() => {
      inFlightByUrl.delete(source.audioUrl)
    })

  inFlightByUrl.set(source.audioUrl, requestPromise)
  return requestPromise
}

export function useTrackSignalMetadata(
  source: AudioSource | null,
): UseTrackSignalMetadataResult {
  const [resolvedByUrl, setResolvedByUrl] = useState<Map<string, MetadataCacheEntry>>(
    () => new Map(),
  )
  const requestIdRef = useRef(0)

  const configuredMetadata = useMemo(() => {
    if (!source) {
      return null
    }

    return createConfiguredTrackSignalMetadata(source)
  }, [source])

  useEffect(() => {
    if (!source || source.kind !== 'demo-track') {
      return
    }

    if (metadataCache.has(source.audioUrl) || resolvedByUrl.has(source.audioUrl)) {
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const controller = new AbortController()

    loadTrackSignalMetadata(source, controller.signal)
      .then((entry) => {
        if (requestIdRef.current !== requestId) {
          return
        }

        setResolvedByUrl((current) => {
          if (current.get(source.audioUrl)) {
            return current
          }

          const next = new Map(current)
          next.set(source.audioUrl, entry)
          return next
        })
      })
      .catch((error: unknown) => {
        if (requestIdRef.current !== requestId) {
          return
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        const fallbackEntry = metadataCache.get(source.audioUrl)

        if (!fallbackEntry) {
          return
        }

        setResolvedByUrl((current) => {
          if (current.get(source.audioUrl)) {
            return current
          }

          const next = new Map(current)
          next.set(source.audioUrl, fallbackEntry)
          return next
        })
      })

    return () => {
      controller.abort()
    }
  }, [resolvedByUrl, source])

  if (!source) {
    return {
      status: 'idle',
      metadata: null,
      errorMessage: null,
    }
  }

  if (source.kind !== 'demo-track') {
    return {
      status: 'unsupported-source',
      metadata: configuredMetadata,
      errorMessage: null,
    }
  }

  const cachedEntry = metadataCache.get(source.audioUrl) ?? resolvedByUrl.get(source.audioUrl)

  if (cachedEntry) {
    return deriveMetadataFromEntry(cachedEntry)
  }

  return {
    status: 'loading',
    metadata: configuredMetadata,
    errorMessage: null,
  }
}
