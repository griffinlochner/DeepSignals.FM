import { useEffect, useRef, useState } from 'react'
import type { TrackSignalMetadata } from './trackSignalMetadata'

export type ExternalNowPlayingMetadata = TrackSignalMetadata & {
  changeKey: string
  rawNowPlaying?: string
}

export type ExternalNowPlayingConfig<T extends { changeKey: string } = ExternalNowPlayingMetadata> = {
  sourceId: string
  nowPlayingUrl: string
  pollMs: number
  hiddenPollMs?: number
  refreshOnVisible?: boolean
  cache?: RequestCache
  fetchResponseType: 'json' | 'text'
  parse: (raw: unknown) => T | null
}

/**
 * Shared polling engine behind the per-station now-playing hooks (see
 * usePsyStreamNowPlaying.ts, usePsyBrazilNowPlaying.ts). Each station only
 * supplies its endpoint + a response parser; polling/abort/cache-bust
 * lifecycle logic lives here once.
 */
export function useExternalNowPlaying<T extends { changeKey: string } = ExternalNowPlayingMetadata>(
  selectedSourceId: string | null,
  config: ExternalNowPlayingConfig<T>,
) {
  const [metadata, setMetadata] = useState<T | null>(null)
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    requestGenerationRef.current += 1
    const generation = requestGenerationRef.current

    if (selectedSourceId !== config.sourceId) {
      return
    }

    let timeoutHandle: number | null = null
    let activeController: AbortController | null = null
    let inFlight = false

    const poll = async () => {
      inFlight = true
      activeController = new AbortController()

      try {
        const response = await fetch(config.nowPlayingUrl, {
          cache: config.cache ?? 'no-store',
          mode: 'cors',
          signal: activeController.signal,
        })

        if (!response.ok) {
          throw new Error(
            `${config.sourceId} metadata request failed (${response.status})`,
          )
        }

        const raw =
          config.fetchResponseType === 'text'
            ? await response.text()
            : await response.json()
        const nextMetadata = config.parse(raw)

        if (requestGenerationRef.current !== generation) {
          return
        }

        setMetadata((current) =>
          current?.changeKey === nextMetadata?.changeKey ? current : nextMetadata,
        )
      } catch (error) {
        if (
          activeController?.signal.aborted ||
          requestGenerationRef.current !== generation
        ) {
          return
        }

        console.warn(`${config.sourceId} Now Playing metadata unavailable`, error)
        setMetadata(null)
      } finally {
        inFlight = false
        if (requestGenerationRef.current === generation) {
          const delay = document.visibilityState === 'hidden'
            ? config.hiddenPollMs ?? config.pollMs
            : config.pollMs
          timeoutHandle = window.setTimeout(poll, delay)
        }
      }
    }

    // An in-flight poll reschedules itself with the visible cadence when it settles.
    const handleVisibilityChange = () => {
      if (
        document.visibilityState !== 'visible' ||
        inFlight ||
        requestGenerationRef.current !== generation
      ) {
        return
      }

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
        timeoutHandle = null
      }

      void poll()
    }

    if (config.refreshOnVisible) {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    void poll()

    return () => {
      requestGenerationRef.current += 1
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      activeController?.abort()
      setMetadata(null)

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [selectedSourceId, config])

  return selectedSourceId === config.sourceId ? metadata : null
}
