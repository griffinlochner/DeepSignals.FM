import { useEffect, useRef, useState } from 'react'
import type { TrackSignalMetadata } from './trackSignalMetadata'

const PSYSTREAM_SOURCE_ID = 'psystream'
const PSYSTREAM_NOW_PLAYING_URL =
  'https://radio.psymusic.co.uk/api/nowplaying_static/psystream.json'
const PSYSTREAM_METADATA_POLL_MS = 12_000

type PsyStreamNowPlaying = TrackSignalMetadata & {
  changeKey: string
}

type PsyStreamNowPlayingResponse = {
  now_playing?: {
    sh_id?: unknown
    played_at?: unknown
    song?: {
      id?: unknown
      artist?: unknown
      title?: unknown
      art?: unknown
    }
  }
}

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function parsePsyStreamNowPlaying(value: unknown): PsyStreamNowPlaying | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const nowPlaying = (value as PsyStreamNowPlayingResponse).now_playing
  const artist = cleanString(nowPlaying?.song?.artist)
  const title = cleanString(nowPlaying?.song?.title)

  if (!artist || !title) {
    return null
  }

  const songId = cleanString(nowPlaying?.song?.id)
  const shId = nowPlaying?.sh_id
  const playedAt = nowPlaying?.played_at
  const artworkUrl = cleanString(nowPlaying?.song?.art) ?? undefined
  const changeKey = [songId, shId, playedAt, artist, title]
    .filter((part) => part !== null && part !== undefined)
    .join(':')

  return {
    sourceUrl: PSYSTREAM_NOW_PLAYING_URL,
    title,
    artist,
    artworkUrl,
    origin: 'configured',
    changeKey,
  }
}

export function usePsyStreamNowPlaying(selectedSourceId: string | null) {
  const [metadata, setMetadata] = useState<PsyStreamNowPlaying | null>(null)
  const requestGenerationRef = useRef(0)

  useEffect(() => {
    requestGenerationRef.current += 1
    const generation = requestGenerationRef.current

    if (selectedSourceId !== PSYSTREAM_SOURCE_ID) {
      return
    }

    let timeoutHandle: number | null = null
    let activeController: AbortController | null = null

    const poll = async () => {
      activeController = new AbortController()

      try {
        const response = await fetch(PSYSTREAM_NOW_PLAYING_URL, {
          cache: 'no-store',
          mode: 'cors',
          signal: activeController.signal,
        })

        if (!response.ok) {
          throw new Error(`PsyStream metadata request failed (${response.status})`)
        }

        const nextMetadata = parsePsyStreamNowPlaying(await response.json())

        if (requestGenerationRef.current !== generation) {
          return
        }

        setMetadata((current) =>
          current?.changeKey === nextMetadata?.changeKey ? current : nextMetadata,
        )
      } catch (error) {
        if (
          activeController.signal.aborted ||
          requestGenerationRef.current !== generation
        ) {
          return
        }

        console.warn('PsyStream Now Playing metadata unavailable', error)
        setMetadata(null)
      } finally {
        if (requestGenerationRef.current === generation) {
          timeoutHandle = window.setTimeout(poll, PSYSTREAM_METADATA_POLL_MS)
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
  }, [selectedSourceId])

  return selectedSourceId === PSYSTREAM_SOURCE_ID ? metadata : null
}