import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO_SOURCES, DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE } from './audioSources'
import type { AudioPlaybackStatus, AudioSource } from './playerTypes'

type UsePersistentAudioControllerResult = {
  audioElement: HTMLAudioElement | null
  audioSource: AudioSource
  playbackStatus: AudioPlaybackStatus
  currentTime: number
  duration: number
  volume: number
  isSeeking: boolean
  seekable: boolean
  metadataLoaded: boolean
  errorMessage: string | null
  play: () => Promise<void>
  pause: () => void
  togglePlay: () => Promise<void>
  setVolume: (value: number) => void
  seekTo: (value: number) => void
}

let sharedAudioElement: HTMLAudioElement | null = null
const LIVE_RETRY_DELAYS_MS = [3_000, 8_000, 15_000]
const LIVE_RECOVERY_WINDOW_MS = 20_000

function clearRecoveryTimer(timer: { current: number | null }) {
  if (timer.current !== null) {
    window.clearTimeout(timer.current)
    timer.current = null
  }
}

function getSharedAudioElement() {
  if (!sharedAudioElement) {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.loop = false
    audio.crossOrigin = 'anonymous'
    sharedAudioElement = audio
  }

  return sharedAudioElement
}

function clampVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 0.7
  }

  return Math.min(1, Math.max(0, value))
}

function getPlaybackErrorMessage(audio: HTMLAudioElement) {
  const error = audio.error

  if (!error) {
    return 'Playback failed.'
  }

  if (error.code === MediaError.MEDIA_ERR_ABORTED) {
    return 'Playback was aborted.'
  }

  if (error.code === MediaError.MEDIA_ERR_NETWORK) {
    return 'Network error while loading audio.'
  }

  if (error.code === MediaError.MEDIA_ERR_DECODE) {
    return 'Audio could not be decoded.'
  }

  if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return 'Audio source is not supported.'
  }

  return 'Playback failed.'
}

export function usePersistentAudioController(initialVolume = 0.7, selectedSourceId?: string): UsePersistentAudioControllerResult {
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const playbackStatusRef = useRef<AudioPlaybackStatus>('idle')
  const pendingPlayRequestRef = useRef(false)
  const playRequestGenerationRef = useRef(0)
  const playIntentRef = useRef(false)
  const liveSourceRef = useRef(false)
  const recoveryAttemptsRef = useRef(0)
  const recoveryTimerRef = useRef<number | null>(null)
  const recoveryDeadlineRef = useRef<number | null>(null)
  const sourceUrlRef = useRef<string>('')
  const safeInitialVolume = clampVolume(initialVolume)
  const volumeRef = useRef(safeInitialVolume)
  const seekableRef = useRef(DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE.isSeekable)
  const [playbackStatus, setPlaybackStatus] = useState<AudioPlaybackStatus>('idle')
  const [audioElement] = useState<HTMLAudioElement | null>(() =>
    typeof window === 'undefined' ? null : getSharedAudioElement(),
  )
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(safeInitialVolume)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekable, setSeekable] = useState(DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE.isSeekable)
  const [metadataLoaded, setMetadataLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const cancelRecovery = useCallback(() => {
    clearRecoveryTimer(recoveryTimerRef)
    recoveryDeadlineRef.current = null
  }, [])

  const audioSource = useMemo(() => {
    if (!selectedSourceId) {
      return AUDIO_SOURCES[0] ?? DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE
    }

    return (
      AUDIO_SOURCES.find((source) => source.id === selectedSourceId) ??
      AUDIO_SOURCES[0] ??
      DEMO_PSYCHEDELIC_EXPERIENCE_AUDIO_SOURCE
    )
  }, [selectedSourceId])

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  useEffect(() => {
    const audio = getSharedAudioElement()
    audio.volume = volumeRef.current
    audioElementRef.current = audio

    const stopRecovery = (message: string) => {
      playRequestGenerationRef.current += 1
      playIntentRef.current = false
      pendingPlayRequestRef.current = false
      cancelRecovery()
      setPlaybackStatus('error')
      playbackStatusRef.current = 'error'
      setMetadataLoaded(false)
      setErrorMessage(message)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }

    const expireRecovery = () => {
      if (recoveryDeadlineRef.current === null || Date.now() < recoveryDeadlineRef.current) return false
      stopRecovery('Live stream interrupted. Press Play to reconnect.')
      return true
    }

    const scheduleRecovery = (delay?: number) => {
      if (!liveSourceRef.current || !playIntentRef.current || recoveryTimerRef.current !== null) return
      recoveryDeadlineRef.current ??= Date.now() + LIVE_RECOVERY_WINDOW_MS
      if (expireRecovery()) return
      const scheduledGeneration = playRequestGenerationRef.current
      const deadline = recoveryDeadlineRef.current
      pendingPlayRequestRef.current = true
      setPlaybackStatus('loading')
      playbackStatusRef.current = 'loading'
      recoveryTimerRef.current = window.setTimeout(() => {
        if (scheduledGeneration !== playRequestGenerationRef.current || deadline !== recoveryDeadlineRef.current) return
        recoveryTimerRef.current = null
        if (!playIntentRef.current || expireRecovery()) return
        if (recoveryAttemptsRef.current >= LIVE_RETRY_DELAYS_MS.length) {
          stopRecovery('Live stream interrupted. Press Play to reconnect.')
          return
        }
        recoveryAttemptsRef.current += 1
        const generation = ++playRequestGenerationRef.current
        audio.src = sourceUrlRef.current
        audio.load()
        // Bound a reconnect that never resolves or emits another media event.
        scheduleRecovery(15_000)
        void audio.play().then(() => {
          if (generation === playRequestGenerationRef.current) expireRecovery()
        }).catch((error: unknown) => {
          if (generation !== playRequestGenerationRef.current) return
          if (expireRecovery()) return
          if (!playIntentRef.current && error instanceof DOMException && error.name === 'AbortError') return
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            stopRecovery('Playback needs your permission. Press Play to reconnect.')
            return
          }
          setErrorMessage(error instanceof Error ? error.message : 'Live stream reconnect failed.')
          scheduleRecovery()
        })
      }, Math.min(
        delay ?? LIVE_RETRY_DELAYS_MS[recoveryAttemptsRef.current] ?? 15_000,
        deadline - Date.now(),
      ))
    }

    const syncVolume = () => {
      setVolumeState(audio.volume)
    }

    const syncTime = () => {
      setCurrentTime(audio.currentTime)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      setSeekable(seekableRef.current && Number.isFinite(audio.duration) && audio.duration > 0)
    }

    const handleLoadStart = () => {
      setMetadataLoaded(false)

      if (pendingPlayRequestRef.current) {
        setPlaybackStatus('loading')
      } else if (audio.readyState > 0) {
        syncTime()
      }
    }

    const handleLoadedMetadata = () => {
      setMetadataLoaded(true)
      syncTime()
    }

    const handleCanPlay = () => {
      if (pendingPlayRequestRef.current || playbackStatusRef.current === 'loading') {
        setPlaybackStatus('loading')
      }
    }

    const handlePlaying = () => {
      if (expireRecovery()) return
      if (!playIntentRef.current) {
        audio.pause()
        return
      }
      if (audio.paused) return
      cancelRecovery()
      pendingPlayRequestRef.current = false
      setPlaybackStatus('playing')
      playbackStatusRef.current = 'playing'
      setErrorMessage(null)
      syncTime()
    }

    const handlePause = () => {
      if (!audio.paused) return
      // Network failures/endings may pause media without cancelling listener intent.
      if (playIntentRef.current && (audio.error || audio.ended)) return
      playIntentRef.current = false
      cancelRecovery()
      pendingPlayRequestRef.current = false
      setPlaybackStatus((current) => (current === 'playing' || current === 'loading' ? 'paused' : current))
      if (playbackStatusRef.current !== 'error') playbackStatusRef.current = 'paused'
      syncTime()
    }

    const handleWaiting = () => {
      if (pendingPlayRequestRef.current || playbackStatusRef.current === 'playing') {
        setPlaybackStatus('loading')
        playbackStatusRef.current = 'loading'
      }
      scheduleRecovery(15_000)
    }

    const handleStalled = () => {
      if (audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        handleWaiting()
      }
    }

    const handleSeeking = () => {
      setIsSeeking(true)
      syncTime()
    }

    const handleSeeked = () => {
      setIsSeeking(false)
      syncTime()
    }

    const handleTimeUpdate = () => {
      if (expireRecovery()) return
      syncTime()
    }

    const handleVolumeChange = () => {
      syncVolume()
    }

    const handleEnded = () => {
      pendingPlayRequestRef.current = false
      setPlaybackStatus('paused')
      playbackStatusRef.current = 'paused'
      syncTime()
      scheduleRecovery()
    }

    const handleError = () => {
      if (!audio.error) return
      pendingPlayRequestRef.current = false
      setPlaybackStatus('error')
      playbackStatusRef.current = 'error'
      setMetadataLoaded(false)
      setErrorMessage(getPlaybackErrorMessage(audio))
      if (audio.error.code === MediaError.MEDIA_ERR_NETWORK) {
        clearRecoveryTimer(recoveryTimerRef)
        scheduleRecovery()
      } else {
        stopRecovery(getPlaybackErrorMessage(audio))
      }
    }

    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('stalled', handleStalled)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('seeking', handleSeeking)
    audio.addEventListener('seeked', handleSeeked)
    audio.addEventListener('volumechange', handleVolumeChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    document.addEventListener('visibilitychange', expireRecovery)

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('stalled', handleStalled)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('seeking', handleSeeking)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('volumechange', handleVolumeChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      document.removeEventListener('visibilitychange', expireRecovery)
      playRequestGenerationRef.current += 1
      playIntentRef.current = false
      cancelRecovery()
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      sourceUrlRef.current = ''
      audioElementRef.current = null
      pendingPlayRequestRef.current = false
    }
  }, [cancelRecovery])

  useEffect(() => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    if (sourceUrlRef.current === audioSource.audioUrl) {
      seekableRef.current = audioSource.isSeekable
      return
    }

    playRequestGenerationRef.current += 1
    playIntentRef.current = false
    cancelRecovery()
    liveSourceRef.current = audioSource.kind === 'live-stream'
    pendingPlayRequestRef.current = false
    seekableRef.current = audioSource.isSeekable
    sourceUrlRef.current = audioSource.audioUrl

    audio.pause()
    audio.removeAttribute('src')
    audio.load()
    playbackStatusRef.current = 'paused'
    setPlaybackStatus('paused')
    setCurrentTime(0)
    setDuration(0)
    setIsSeeking(false)
    setSeekable(false)
    setMetadataLoaded(false)
    setErrorMessage(null)

    audio.preload = audioSource.kind === 'live-stream' ? 'none' : 'metadata'
    audio.src = audioSource.audioUrl
    audio.load()
  }, [audioSource.audioUrl, audioSource.isSeekable, audioSource.kind, cancelRecovery])

  useEffect(() => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    const nextVolume = clampVolume(volume)

    if (audio.volume !== nextVolume) {
      audio.volume = nextVolume
    }
  }, [volume])

  const play = async () => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    const generation = ++playRequestGenerationRef.current
    cancelRecovery()
    playIntentRef.current = true
    recoveryAttemptsRef.current = 0
    if (audioSource.kind === 'live-stream' || audio.error || audio.ended) {
      // Reconnect live radio at the broadcast edge, never at an old paused buffer.
      audio.src = sourceUrlRef.current
      audio.load()
    }
    pendingPlayRequestRef.current = true
    setPlaybackStatus('loading')
    playbackStatusRef.current = 'loading'
    setErrorMessage(null)

    try {
      await audio.play()
    } catch (error) {
      if (generation !== playRequestGenerationRef.current) return
      if (!playIntentRef.current && error instanceof DOMException && error.name === 'AbortError') return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        cancelRecovery()
      }
      // Network failures are handled by the media error event and bounded recovery.
      if (recoveryTimerRef.current !== null) return
      playRequestGenerationRef.current += 1
      playIntentRef.current = false
      pendingPlayRequestRef.current = false
      setPlaybackStatus('error')
      playbackStatusRef.current = 'error'
      setErrorMessage(error instanceof Error ? error.message : 'Playback could not start.')
    }
  }

  const pause = () => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    playRequestGenerationRef.current += 1
    playIntentRef.current = false
    cancelRecovery()
    pendingPlayRequestRef.current = false
    audio.pause()
    if (audioSource.kind === 'live-stream') {
      audio.removeAttribute('src')
      audio.load()
      setMetadataLoaded(false)
    }
    setPlaybackStatus('paused')
    playbackStatusRef.current = 'paused'
  }

  const togglePlay = async () => {
    if (playbackStatusRef.current === 'playing' || playbackStatusRef.current === 'loading') {
      pause()
      return
    }

    await play()
  }

  const setVolume = (value: number) => {
    const nextVolume = clampVolume(value)
    volumeRef.current = nextVolume
    setVolumeState(nextVolume)
  }

  const seekTo = (value: number) => {
    const audio = audioElementRef.current

    if (!audio || !seekable || !Number.isFinite(value)) {
      return
    }

    const boundedValue = Math.min(Math.max(value, 0), Number.isFinite(audio.duration) ? audio.duration : value)

    try {
      audio.currentTime = boundedValue
      setCurrentTime(boundedValue)
    } catch {
      // Ignore seek attempts until the media element is ready.
    }
  }

  return {
    audioElement,
    audioSource,
    playbackStatus,
    currentTime,
    duration,
    volume,
    isSeeking,
    seekable,
    metadataLoaded,
    errorMessage,
    play,
    pause,
    togglePlay,
    setVolume,
    seekTo,
  }
}