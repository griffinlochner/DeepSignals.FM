import { useEffect, useRef, useState } from 'react'
import type { ExternalNowPlayingMetadata } from './useExternalNowPlaying'

export const HIRSCHMILCH_BASE_URL = 'https://hirschmilch.de'
export const HIRSCHMILCH_REST_POLL_MS = 25_000

export const HIRSCHMILCH_CHANNEL_IDS = {
  'hirschmilch-psytrance': 'psytrance',
  'hirschmilch-progressive': 'progressive',
  'hirschmilch-chillout': 'chillout',
} as const

type HirschmilchSignalId = keyof typeof HIRSCHMILCH_CHANNEL_IDS
export type HirschmilchChannelId =
  (typeof HIRSCHMILCH_CHANNEL_IDS)[HirschmilchSignalId]

export type HirschmilchNowPlayingMetadata = ExternalNowPlayingMetadata & {
  channelId: HirschmilchChannelId
  trackId: string
  source?: string
  badge?: string
  badgeDetail?: string
}

type WorkerMetadata = {
  channelId?: unknown
  trackId?: unknown
  artist?: unknown
  title?: unknown
  source?: unknown
  badge?: unknown
  badgeDetail?: unknown
  artworkUrl?: unknown
}

type RuntimeDependencies = {
  fetchJson: (
    channelId: HirschmilchChannelId,
    signal: AbortSignal,
  ) => Promise<unknown>
  setInterval: (callback: () => void, delay: number) => number
  clearInterval: (handle: number) => void
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cleanTrackId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return cleanString(value)
}

export function parseHirschmilchWorkerMetadata(
  value: unknown,
  selectedChannelId: HirschmilchChannelId,
): HirschmilchNowPlayingMetadata | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as WorkerMetadata
  const artist = cleanString(record.artist)
  const title = cleanString(record.title)
  const id = cleanTrackId(record.trackId)

  if (
    record.channelId !== selectedChannelId ||
    !artist ||
    !title ||
    !id
  ) {
    return null
  }

  const artworkUrl = cleanString(record.artworkUrl)

  return {
    sourceUrl: HIRSCHMILCH_BASE_URL,
    artist,
    title,
    artworkUrl: artworkUrl ?? undefined,
    origin: 'configured',
    changeKey: `${selectedChannelId}:${id}`,
    channelId: selectedChannelId,
    trackId: id,
    source: cleanString(record.source) ?? undefined,
    badge: cleanString(record.badge) ?? undefined,
    badgeDetail: cleanString(record.badgeDetail) ?? undefined,
  }
}

async function fetchWorkerMetadata(
  channelId: HirschmilchChannelId,
  signal: AbortSignal,
) {
  const configuredBaseUrl =
    import.meta.env.VITE_HIRSCHMILCH_METADATA_URL?.trim() ??
    (import.meta.env.DEV ? 'http://localhost:8787' : '')

  if (!configuredBaseUrl) {
    throw new Error('VITE_HIRSCHMILCH_METADATA_URL is not configured')
  }

  const endpoint = new URL(
    `${configuredBaseUrl.replace(/\/+$/, '')}/metadata`,
  )
  endpoint.searchParams.set('channel', channelId)

  const response = await fetch(endpoint, {
    cache: 'no-store',
    mode: 'cors',
    signal,
  })

  if (!response.ok) {
    throw new Error(`Hirschmilch Worker request failed (${response.status})`)
  }

  return response.json()
}

const DEFAULT_DEPENDENCIES: RuntimeDependencies = {
  fetchJson: fetchWorkerMetadata,
  setInterval: (callback, delay) => window.setInterval(callback, delay),
  clearInterval: (handle) => window.clearInterval(handle),
}

export class HirschmilchNowPlayingRuntime {
  private channelId: HirschmilchChannelId
  private readonly publish: (
    metadata: HirschmilchNowPlayingMetadata | null,
  ) => void
  private readonly dependencies: RuntimeDependencies
  private intervalHandle: number | null = null
  private abortController: AbortController | null = null
  private stopped = false

  constructor(
    channelId: HirschmilchChannelId,
    publish: (metadata: HirschmilchNowPlayingMetadata | null) => void,
    dependencies: RuntimeDependencies = DEFAULT_DEPENDENCIES,
  ) {
    this.channelId = channelId
    this.publish = publish
    this.dependencies = dependencies
  }

  start() {
    this.intervalHandle = this.dependencies.setInterval(
      () => void this.refresh(),
      HIRSCHMILCH_REST_POLL_MS,
    )
    void this.refresh()
  }

  updateChannel(channelId: HirschmilchChannelId) {
    if (channelId === this.channelId) {
      return
    }

    this.channelId = channelId
    this.abortController?.abort()
    this.abortController = null
    this.setMetadata(null)
    void this.refresh()
  }

  destroy() {
    this.stopped = true
    this.abortController?.abort()
    this.abortController = null

    if (this.intervalHandle !== null) {
      this.dependencies.clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  private setMetadata(metadata: HirschmilchNowPlayingMetadata | null) {
    this.publish(metadata)
  }

  private async refresh() {
    if (this.stopped) {
      return
    }

    this.abortController?.abort()
    const controller = new AbortController()
    const requestedChannel = this.channelId
    this.abortController = controller

    try {
      const value = await this.dependencies.fetchJson(
        requestedChannel,
        controller.signal,
      )
      const next = parseHirschmilchWorkerMetadata(value, requestedChannel)

      if (
        !controller.signal.aborted &&
        requestedChannel === this.channelId &&
        !this.stopped &&
        next
      ) {
        this.setMetadata(next)
      }
    } catch {
      // Track metadata is optional; retain the last valid track and keep playback untouched.
    } finally {
      if (this.abortController === controller) {
        this.abortController = null
      }
    }
  }
}

function isHirschmilchSignalId(
  value: string | null,
): value is HirschmilchSignalId {
  return value !== null && value in HIRSCHMILCH_CHANNEL_IDS
}

export function useHirschmilchNowPlaying(selectedSourceId: string | null) {
  const channelId = isHirschmilchSignalId(selectedSourceId)
    ? HIRSCHMILCH_CHANNEL_IDS[selectedSourceId]
    : null
  const channelIdRef = useRef(channelId)
  const runtimeRef = useRef<HirschmilchNowPlayingRuntime | null>(null)
  const [metadata, setMetadata] =
    useState<HirschmilchNowPlayingMetadata | null>(null)
  const isActive = channelId !== null

  useEffect(() => {
    channelIdRef.current = channelId
  }, [channelId])

  useEffect(() => {
    if (!channelIdRef.current) {
      setMetadata(null)
      return
    }

    const runtime = new HirschmilchNowPlayingRuntime(
      channelIdRef.current,
      setMetadata,
    )
    runtimeRef.current = runtime
    runtime.start()

    return () => {
      runtimeRef.current = null
      runtime.destroy()
      setMetadata(null)
    }
  }, [isActive])

  useEffect(() => {
    if (channelId) {
      runtimeRef.current?.updateChannel(channelId)
    }
  }, [channelId])

  return metadata?.channelId === channelId ? metadata : null
}
