import { useEffect, useRef, useState } from 'react'
import type { ExternalNowPlayingMetadata } from './useExternalNowPlaying'

export const HIRSCHMILCH_BASE_URL = 'https://hirschmilch.de'
export const HIRSCHMILCH_REST_URL =
  `${HIRSCHMILCH_BASE_URL}/channel/ajax/refresh?build=14`
export const HIRSCHMILCH_REST_POLL_MS = 25_000

export const HIRSCHMILCH_CHANNEL_IDS = {
  'hirschmilch-psytrance': 'psytrance',
  'hirschmilch-progressive': 'progressive',
  'hirschmilch-chillout': 'chillout',
} as const

type HirschmilchSignalId = keyof typeof HIRSCHMILCH_CHANNEL_IDS
export type HirschmilchChannelId = (typeof HIRSCHMILCH_CHANNEL_IDS)[HirschmilchSignalId]

export type HirschmilchNowPlayingMetadata = ExternalNowPlayingMetadata & {
  channelId: HirschmilchChannelId
  trackId: string
  source?: string
  badge?: string
  badgeDetail?: string
  duration?: number
}

type HirschmilchTrack = {
  id?: unknown
  duration?: unknown
  metaartist?: unknown
  metatitle?: unknown
  source?: unknown
  badge?: unknown
  badgeDetail?: unknown
  image?: unknown
}

type HirschmilchSocket = {
  connected: boolean
  on: (event: string, listener: (...args: unknown[]) => void) => void
  off: (event: string, listener: (...args: unknown[]) => void) => void
  emit: (event: string, channel: string, acknowledgement: (info: unknown) => void) => void
  disconnect: () => void
}

type RuntimeDependencies = {
  createSocket: () => Promise<HirschmilchSocket>
  fetchJson: (signal: AbortSignal) => Promise<unknown>
  setInterval: (callback: () => void, delay: number) => number
  clearInterval: (handle: number) => void
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function trackId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return cleanString(value)
}

function optionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function resolveArtworkUrl(value: unknown) {
  const path = cleanString(value)
  return path ? new URL(path, HIRSCHMILCH_BASE_URL).href : undefined
}

function metadataFromTrack(
  channelId: HirschmilchChannelId,
  track: HirschmilchTrack,
): HirschmilchNowPlayingMetadata | null {
  const artist = cleanString(track.metaartist)
  const title = cleanString(track.metatitle)
  const id = trackId(track.id)

  if (!artist || !title || !id) {
    return null
  }

  return {
    sourceUrl: HIRSCHMILCH_BASE_URL,
    artist,
    title,
    artworkUrl: resolveArtworkUrl(track.image),
    origin: 'configured',
    changeKey: `${channelId}:${id}`,
    channelId,
    trackId: id,
    source: cleanString(track.source) ?? undefined,
    badge: cleanString(track.badge) ?? undefined,
    badgeDetail: cleanString(track.badgeDetail) ?? undefined,
    duration: optionalNumber(track.duration),
  }
}

export function parseHirschmilchTrackUpdate(
  value: unknown,
  selectedChannelId: HirschmilchChannelId,
) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const update = value as { channel?: unknown; track?: unknown }

  if (update.channel !== selectedChannelId || !update.track || typeof update.track !== 'object') {
    return null
  }

  return metadataFromTrack(selectedChannelId, update.track as HirschmilchTrack)
}

export function parseHirschmilchTuneIn(
  value: unknown,
  selectedChannelId: HirschmilchChannelId,
) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const track = (value as { track?: unknown }).track
  return track && typeof track === 'object'
    ? metadataFromTrack(selectedChannelId, track as HirschmilchTrack)
    : null
}

export function parseHirschmilchRest(
  value: unknown,
  selectedChannelId: HirschmilchChannelId,
  current: HirschmilchNowPlayingMetadata | null,
): HirschmilchNowPlayingMetadata | null {
  if (!Array.isArray(value)) {
    return current
  }

  const record = value.find(
    (candidate) =>
      candidate &&
      typeof candidate === 'object' &&
      (candidate as { id?: unknown }).id === selectedChannelId,
  ) as Record<string, unknown> | undefined
  const artist = cleanString(record?.artist)
  const title = cleanString(record?.title)
  const id = trackId(record?.trackId)

  if (!artist || !title || !id) {
    return current
  }

  return {
    sourceUrl: HIRSCHMILCH_REST_URL,
    artist,
    title,
    artworkUrl: current?.artworkUrl,
    origin: 'configured',
    changeKey: `${selectedChannelId}:${id}`,
    channelId: selectedChannelId,
    trackId: id,
    source: cleanString(record?.source) ?? undefined,
    badge: cleanString(record?.badge) ?? undefined,
    badgeDetail: cleanString(record?.badgeDetail) ?? undefined,
  }
}

async function createSocket() {
  const { io } = await import('socket.io-client')
  return io(HIRSCHMILCH_BASE_URL, { path: '/socket.chat' }) as HirschmilchSocket
}

const DEFAULT_DEPENDENCIES: RuntimeDependencies = {
  createSocket,
  fetchJson: async (signal) => {
    const response = await fetch(HIRSCHMILCH_REST_URL, {
      cache: 'no-store',
      mode: 'cors',
      signal,
    })

    if (!response.ok) {
      throw new Error(`Hirschmilch metadata request failed (${response.status})`)
    }

    return response.json()
  },
  setInterval: (callback, delay) => window.setInterval(callback, delay),
  clearInterval: (handle) => window.clearInterval(handle),
}

export class HirschmilchNowPlayingRuntime {
  private channelId: HirschmilchChannelId
  private readonly publish: (metadata: HirschmilchNowPlayingMetadata | null) => void
  private readonly dependencies: RuntimeDependencies
  private socket: HirschmilchSocket | null = null
  private metadata: HirschmilchNowPlayingMetadata | null = null
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

  private readonly handleConnect = () => {
    this.stopRestFallback()
    this.tuneIn()
  }

  private readonly handleDisconnect = () => this.startRestFallback()
  private readonly handleConnectError = () => this.startRestFallback()
  private readonly handleTrackUpdate = (value: unknown) => {
    const next = parseHirschmilchTrackUpdate(value, this.channelId)
    if (next) {
      this.setMetadata(next)
    }
  }

  async start() {
    const socket = await this.dependencies.createSocket()

    if (this.stopped) {
      socket.disconnect()
      return
    }

    this.socket = socket
    socket.on('connect', this.handleConnect)
    socket.on('disconnect', this.handleDisconnect)
    socket.on('connect_error', this.handleConnectError)
    socket.on('TRACKUPDATE', this.handleTrackUpdate)

    if (socket.connected) {
      this.handleConnect()
    }
  }

  updateChannel(channelId: HirschmilchChannelId) {
    if (channelId === this.channelId) {
      return
    }

    this.channelId = channelId
    this.setMetadata(null)
    this.abortController?.abort()

    if (this.socket?.connected) {
      this.tuneIn()
    } else if (this.intervalHandle !== null) {
      void this.refreshFromRest()
    }
  }

  destroy() {
    this.stopped = true
    this.stopRestFallback()
    this.socket?.off('connect', this.handleConnect)
    this.socket?.off('disconnect', this.handleDisconnect)
    this.socket?.off('connect_error', this.handleConnectError)
    this.socket?.off('TRACKUPDATE', this.handleTrackUpdate)
    this.socket?.disconnect()
    this.socket = null
  }

  private setMetadata(metadata: HirschmilchNowPlayingMetadata | null) {
    this.metadata = metadata
    this.publish(metadata)
  }

  private tuneIn() {
    const requestedChannel = this.channelId
    this.socket?.emit('TUNEIN', `channel:${requestedChannel}`, (info) => {
      if (requestedChannel !== this.channelId || this.stopped) {
        return
      }

      const next = parseHirschmilchTuneIn(info, requestedChannel)
      if (next) {
        this.setMetadata(next)
      }
    })
  }

  private startRestFallback() {
    if (this.intervalHandle !== null || this.stopped) {
      return
    }

    void this.refreshFromRest()
    this.intervalHandle = this.dependencies.setInterval(
      () => void this.refreshFromRest(),
      HIRSCHMILCH_REST_POLL_MS,
    )
  }

  private stopRestFallback() {
    this.abortController?.abort()
    this.abortController = null

    if (this.intervalHandle !== null) {
      this.dependencies.clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
  }

  private async refreshFromRest() {
    this.abortController?.abort()
    const controller = new AbortController()
    const requestedChannel = this.channelId
    this.abortController = controller

    try {
      const value = await this.dependencies.fetchJson(controller.signal)

      if (!controller.signal.aborted && requestedChannel === this.channelId && !this.stopped) {
        const next = parseHirschmilchRest(value, requestedChannel, this.metadata)
        if (next !== this.metadata) {
          this.setMetadata(next)
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn('Hirschmilch Now Playing metadata unavailable', error)
      }
    }
  }
}

function isHirschmilchSignalId(value: string | null): value is HirschmilchSignalId {
  return value !== null && value in HIRSCHMILCH_CHANNEL_IDS
}

export function useHirschmilchNowPlaying(selectedSourceId: string | null) {
  const channelId = isHirschmilchSignalId(selectedSourceId)
    ? HIRSCHMILCH_CHANNEL_IDS[selectedSourceId]
    : null
  const channelIdRef = useRef(channelId)
  const runtimeRef = useRef<HirschmilchNowPlayingRuntime | null>(null)
  const [metadata, setMetadata] = useState<HirschmilchNowPlayingMetadata | null>(null)
  const isActive = channelId !== null

  useEffect(() => {
    channelIdRef.current = channelId
  }, [channelId])

  useEffect(() => {
    if (!channelIdRef.current) {
      setMetadata(null)
      return
    }

    const runtime = new HirschmilchNowPlayingRuntime(channelIdRef.current, setMetadata)
    runtimeRef.current = runtime
    void runtime.start()

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