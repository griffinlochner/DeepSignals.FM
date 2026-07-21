import { useEffect, useMemo, useRef, useState } from 'react'
import { AUDIO_SOURCES, DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE } from './audioSources'
import type { AudioPlaybackStatus, AudioSource } from './playerTypes'

type UsePersistentAudioControllerResult = {
  audioSource: AudioSource
  playbackStatus: AudioPlaybackStatus
  currentTime: number
  duration: number
  volume: number
  muted: boolean
  isSeeking: boolean
  seekable: boolean
  errorMessage: string | null
  play: () => Promise<void>
  pause: () => void
  togglePlay: () => Promise<void>
  setVolume: (value: number) => void
  toggleMute: () => void
  seekTo: (value: number) => void
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

export function usePersistentAudioController(): UsePersistentAudioControllerResult {
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const playbackStatusRef = useRef<AudioPlaybackStatus>('idle')
  const pendingPlayRequestRef = useRef(false)
  const volumeRef = useRef(0.7)
  const mutedRef = useRef(false)
  const seekableRef = useRef(DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE.isSeekable)
  const [playbackStatus, setPlaybackStatus] = useState<AudioPlaybackStatus>('idle')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(0.7)
  const [muted, setMutedState] = useState(false)
  const [isSeeking, setIsSeeking] = useState(false)
  const [seekable, setSeekable] = useState(DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE.isSeekable)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const audioSource = useMemo(() => AUDIO_SOURCES[0] ?? DEMO_MODULATION_MANIPULATION_AUDIO_SOURCE, [])

  useEffect(() => {
    volumeRef.current = volume
  }, [volume])

  useEffect(() => {
    mutedRef.current = muted
  }, [muted])

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.loop = false
    audio.volume = volumeRef.current
    audio.muted = mutedRef.current
    audio.src = audioSource.audioUrl
    audioElementRef.current = audio

    const syncVolume = () => {
      setVolumeState(audio.volume)
      setMutedState(audio.muted)
    }

    const syncTime = () => {
      setCurrentTime(audio.currentTime)
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
      setSeekable(seekableRef.current && Number.isFinite(audio.duration) && audio.duration > 0)
    }

    const handleLoadStart = () => {
      if (pendingPlayRequestRef.current) {
        setPlaybackStatus('loading')
      } else if (audio.readyState > 0) {
        syncTime()
      }
    }

    const handleLoadedMetadata = () => {
      syncTime()
    }

    const handleCanPlay = () => {
      if (pendingPlayRequestRef.current || playbackStatusRef.current === 'loading') {
        setPlaybackStatus('loading')
      }
    }

    const handlePlaying = () => {
      pendingPlayRequestRef.current = false
      setPlaybackStatus('playing')
      playbackStatusRef.current = 'playing'
      setErrorMessage(null)
      syncTime()
    }

    const handlePause = () => {
      pendingPlayRequestRef.current = false
      setPlaybackStatus((current) => (current === 'playing' || current === 'loading' ? 'paused' : current))
      playbackStatusRef.current = 'paused'
      syncTime()
    }

    const handleWaiting = () => {
      if (pendingPlayRequestRef.current || playbackStatusRef.current === 'playing') {
        setPlaybackStatus('loading')
        playbackStatusRef.current = 'loading'
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
    }

    const handleError = () => {
      pendingPlayRequestRef.current = false
      setPlaybackStatus('error')
      playbackStatusRef.current = 'error'
      setErrorMessage(getPlaybackErrorMessage(audio))
    }

    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('seeking', handleSeeking)
    audio.addEventListener('seeked', handleSeeked)
    audio.addEventListener('volumechange', handleVolumeChange)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    audio.load()

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('seeking', handleSeeking)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('volumechange', handleVolumeChange)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      audioElementRef.current = null
      pendingPlayRequestRef.current = false
    }
  }, [audioSource.audioUrl])

  useEffect(() => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    if (audio.volume !== volume) {
      audio.volume = volume
    }
  }, [volume])

  useEffect(() => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    if (audio.muted !== muted) {
      audio.muted = muted
    }
  }, [muted])

  const play = async () => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    pendingPlayRequestRef.current = true
    setPlaybackStatus('loading')
    playbackStatusRef.current = 'loading'
    setErrorMessage(null)

    try {
      await audio.play()
    } catch (error) {
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

    pendingPlayRequestRef.current = false
    audio.pause()
    setPlaybackStatus('paused')
    playbackStatusRef.current = 'paused'
  }

  const togglePlay = async () => {
    if (playbackStatus === 'playing') {
      pause()
      return
    }

    await play()
  }

  const toggleMute = () => {
    const audio = audioElementRef.current

    if (!audio) {
      return
    }

    audio.muted = !audio.muted
    setMutedState(audio.muted)
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
    audioSource,
    playbackStatus,
    currentTime,
    duration,
    volume,
    muted,
    isSeeking,
    seekable,
    errorMessage,
    play,
    pause,
    togglePlay,
    setVolume: setVolumeState,
    toggleMute,
    seekTo,
  }
}