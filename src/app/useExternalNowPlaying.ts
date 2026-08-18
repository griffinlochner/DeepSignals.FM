import { useEffect, useRef, useState } from 'react'
import type { TrackSignalMetadata } from './trackSignalMetadata'

export type ExternalNowPlayingMetadata = TrackSignalMetadata & {
  changeKey: string
}

export type ExternalNowPlayingConfig = {
  sourceId: string
  nowPlayingUrl: string
  pollMs: number
  fetchResponseType: 'json' | 'text'
  parse: (raw: unknown) => ExternalNowPlayingMetadata | null
}

/**
 * Shared polling engine behind the per-station now-playing hooks (see
 * usePsyStreamNowPlaying.ts, usePsyBrazilNowPlaying.ts). Each station only
 * supplies its endpoint + a response parser; polling/abort/cache-bust
 * lifecycle logic lives here once.
 */
export function useExternalNowPlaying(
  selectedSourceId: string | null,
  config: ExternalNowPlayingConfig,
) {
  const [metadata, setMetadata] = useState<ExternalNowPlayingMetadata | null>(null)
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    requestGenerationRef.current += 1
    const generation = requestGenerationRef.current

    if (selectedSourceId !== config.sourceId) {
      return
    }

    let timeoutHandle: number | null = null
    let activeController: AbortController | null = null

    const poll = async () => {
      activeController = new AbortController()

      try {
        const response = await fetch(config.nowPlayingUrl, {
          cache: 'no-store',
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
        if (requestGenerationRef.current === generation) {
          timeoutHandle = window.setTimeout(poll, config.pollMs)
        }
      }
    }

    void poll()

    return () => {
      requestGenerationRef.current += 1
      activeController?.abort()
      setMetadata(null)

      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [selectedSourceId, config])

  return selectedSourceId === config.sourceId ? metadata : null
}
