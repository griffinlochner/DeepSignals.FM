import { useEffect, useRef, useState } from 'react'
import './stationIdentOverlay.css'

type StationIdentOverlayProps = {
  isAudioPlaying: boolean
}

type IdentPhase = 'idle' | 'materializing' | 'decoding' | 'locked' | 'dematerializing'
type DelayMode = 'initial' | 'recurring'

type CellState = {
  glyph: string
  resolved: boolean
  flashing: boolean
}

const TARGET_TEXT = 'DeepSignals.FM'
const TARGET_CHARS = TARGET_TEXT.split('')

const GLYPH_POOL = [
  'A',
  'E',
  'H',
  'K',
  'M',
  'N',
  'R',
  'T',
  'X',
  'Z',
  '0',
  '1',
  '3',
  '4',
  '7',
  '8',
  '@',
  '#',
  '%',
  '&',
  '/',
  '\\',
  '|',
  '<',
  '>',
  '[',
  ']',
  '{',
  '}',
  '+',
  '=',
  '*',
  '?',
  '∆',
  'Λ',
  'Ξ',
  'Ω',
  'Φ',
  'Ψ',
  'ϟ',
]

const DESKTOP_MIN_WIDTH = 1100
const DESKTOP_MIN_HEIGHT = 621

const MATERIALIZE_DURATION_MS = 720
const DECODE_DURATION_MS = 6400
const LOCKED_DURATION_MS = 2100
const DEMATERIALIZE_DURATION_MS = 850
const CHARACTER_FLASH_DURATION_MS = 280
const GLYPH_TICK_MS = 80

const REDUCED_MATERIALIZE_DURATION_MS = 360
const REDUCED_LOCKED_DURATION_MS = 1800
const REDUCED_DEMATERIALIZE_DURATION_MS = 520

const PRODUCTION_FIRST_MIN_MS = 25000
const PRODUCTION_FIRST_MAX_MS = 40000
const PRODUCTION_RECURRING_MIN_MS = 4 * 60 * 1000
const PRODUCTION_RECURRING_MAX_MS = 7 * 60 * 1000

const DEBUG_FIRST_MS = 2000
const DEBUG_RECURRING_MIN_MS = 15000
const DEBUG_RECURRING_MAX_MS = 20000

function randomInt(maxExclusive: number) {
  return Math.floor(Math.random() * maxExclusive)
}

function randomBetween(minMs: number, maxMs: number) {
  return minMs + Math.random() * (maxMs - minMs)
}

function randomGlyph() {
  return GLYPH_POOL[randomInt(GLYPH_POOL.length)]
}

function buildInitialCells(): CellState[] {
  return TARGET_CHARS.map(() => ({ glyph: randomGlyph(), resolved: false, flashing: false }))
}

function buildResolvedCells(): CellState[] {
  return TARGET_CHARS.map((char) => ({ glyph: char, resolved: true, flashing: false }))
}

function shuffleIndices(length: number) {
  const indices = Array.from({ length }, (_, index) => index)

  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    const current = indices[index]
    indices[index] = indices[swapIndex]
    indices[swapIndex] = current
  }

  return indices
}

function buildResolveEvents(totalDurationMs: number) {
  const order = shuffleIndices(TARGET_CHARS.length)
  const baseStep = totalDurationMs / (TARGET_CHARS.length + 1)

  return order
    .map((charIndex, eventIndex) => {
      const baseTime = (eventIndex + 1) * baseStep
      const jitter = (Math.random() - 0.5) * Math.min(420, baseStep * 0.85)
      const clampedTime = Math.min(
        totalDurationMs - 140,
        Math.max(140, Math.round(baseTime + jitter)),
      )

      return {
        charIndex,
        timeMs: clampedTime,
      }
    })
    .sort((left, right) => left.timeMs - right.timeMs)
}

function getViewportEligible() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.innerWidth >= DESKTOP_MIN_WIDTH && window.innerHeight >= DESKTOP_MIN_HEIGHT
}

function getReducedMotionPreferred() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getDocumentVisible() {
  if (typeof document === 'undefined') {
    return true
  }

  return document.visibilityState === 'visible'
}

function isIdentDebugEnabled() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return false
  }

  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('identDebug') === '1'
}

function StationIdentOverlay({ isAudioPlaying }: StationIdentOverlayProps) {
  const [identDebugEnabled] = useState(() => isIdentDebugEnabled())

  const [phase, setPhase] = useState<IdentPhase>('idle')
  const [cells, setCells] = useState<CellState[]>(() => buildInitialCells())
  const [lockOnActive, setLockOnActive] = useState(false)
  const [viewportEligible, setViewportEligible] = useState(() => getViewportEligible())
  const [documentVisible, setDocumentVisible] = useState(() => getDocumentVisible())
  const [reducedMotion, setReducedMotion] = useState(() => getReducedMotionPreferred())

  const phaseRef = useRef<IdentPhase>('idle')
  const canRunRef = useRef(false)
  const runTokenRef = useRef(0)
  const nextDelayModeRef = useRef<DelayMode>('initial')
  const scheduledTimeoutRef = useRef<number | null>(null)
  const scrambleIntervalRef = useRef<number | null>(null)
  const animationTimeoutsRef = useRef<number[]>([])
  const scheduleNextIdentRef = useRef<() => void>(() => {})
  const cancelActiveSequenceRef = useRef<(nextDelayMode: DelayMode) => void>(() => {})

  const canRun = isAudioPlaying && viewportEligible && documentVisible

  const clearScheduledTimeout = () => {
    if (scheduledTimeoutRef.current !== null) {
      window.clearTimeout(scheduledTimeoutRef.current)
      scheduledTimeoutRef.current = null
    }
  }

  const clearScrambleInterval = () => {
    if (scrambleIntervalRef.current !== null) {
      window.clearInterval(scrambleIntervalRef.current)
      scrambleIntervalRef.current = null
    }
  }

  const clearAnimationTimeouts = () => {
    animationTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId)
    })

    animationTimeoutsRef.current = []
  }

  const resetVisualState = () => {
    setPhase('idle')
    setCells(buildInitialCells())
    setLockOnActive(false)
  }

  const cancelActiveSequence = (nextDelayMode: DelayMode) => {
    runTokenRef.current += 1
    clearScrambleInterval()
    clearAnimationTimeouts()
    phaseRef.current = 'idle'
    nextDelayModeRef.current = nextDelayMode
    resetVisualState()
  }

  const pickDelayMs = (delayMode: DelayMode) => {
    if (identDebugEnabled) {
      if (delayMode === 'initial') {
        return DEBUG_FIRST_MS
      }

      return randomBetween(DEBUG_RECURRING_MIN_MS, DEBUG_RECURRING_MAX_MS)
    }

    if (delayMode === 'initial') {
      return randomBetween(PRODUCTION_FIRST_MIN_MS, PRODUCTION_FIRST_MAX_MS)
    }

    return randomBetween(PRODUCTION_RECURRING_MIN_MS, PRODUCTION_RECURRING_MAX_MS)
  }

  const scheduleNextIdent = () => {
    if (!canRunRef.current || phaseRef.current !== 'idle') {
      return
    }

    if (scheduledTimeoutRef.current !== null) {
      return
    }

    const delayMs = pickDelayMs(nextDelayModeRef.current)

    scheduledTimeoutRef.current = window.setTimeout(() => {
      scheduledTimeoutRef.current = null

      if (!canRunRef.current || phaseRef.current !== 'idle') {
        return
      }

      nextDelayModeRef.current = 'recurring'

      const runToken = runTokenRef.current + 1
      runTokenRef.current = runToken
      setLockOnActive(false)

      if (reducedMotion) {
        phaseRef.current = 'materializing'
        setPhase('materializing')
        setCells(buildResolvedCells())

        const reducedMaterializeTimeout = window.setTimeout(() => {
          if (runTokenRef.current !== runToken || !canRunRef.current) {
            return
          }

          phaseRef.current = 'locked'
          setPhase('locked')

          const reducedLockTimeout = window.setTimeout(() => {
            if (runTokenRef.current !== runToken || !canRunRef.current) {
              return
            }

            phaseRef.current = 'dematerializing'
            setPhase('dematerializing')

            const reducedExitTimeout = window.setTimeout(() => {
              if (runTokenRef.current !== runToken) {
                return
              }

              phaseRef.current = 'idle'
              resetVisualState()

              if (canRunRef.current) {
                scheduleNextIdentRef.current()
              }
            }, REDUCED_DEMATERIALIZE_DURATION_MS)

            animationTimeoutsRef.current.push(reducedExitTimeout)
          }, REDUCED_LOCKED_DURATION_MS)

          animationTimeoutsRef.current.push(reducedLockTimeout)
        }, REDUCED_MATERIALIZE_DURATION_MS)

        animationTimeoutsRef.current.push(reducedMaterializeTimeout)
        return
      }

      phaseRef.current = 'materializing'
      setPhase('materializing')
      setCells(buildInitialCells())

      const materializeTimeout = window.setTimeout(() => {
        if (runTokenRef.current !== runToken || !canRunRef.current) {
          return
        }

        phaseRef.current = 'decoding'
        setPhase('decoding')

        clearScrambleInterval()

        scrambleIntervalRef.current = window.setInterval(() => {
          setCells((currentCells) =>
            currentCells.map((cell) =>
              cell.resolved
                ? cell
                : {
                    ...cell,
                    glyph: randomGlyph(),
                  },
            ),
          )
        }, GLYPH_TICK_MS)

        const resolveEvents = buildResolveEvents(DECODE_DURATION_MS)

        resolveEvents.forEach(({ charIndex, timeMs }) => {
          const resolveTimeout = window.setTimeout(() => {
            if (runTokenRef.current !== runToken || !canRunRef.current) {
              return
            }

            setCells((currentCells) =>
              currentCells.map((cell, index) =>
                index === charIndex
                  ? {
                      glyph: TARGET_CHARS[index],
                      resolved: true,
                      flashing: true,
                    }
                  : cell,
              ),
            )

            const flashTimeout = window.setTimeout(() => {
              if (runTokenRef.current !== runToken) {
                return
              }

              setCells((currentCells) =>
                currentCells.map((cell, index) =>
                  index === charIndex
                    ? {
                        ...cell,
                        flashing: false,
                      }
                    : cell,
                ),
              )
            }, CHARACTER_FLASH_DURATION_MS)

            animationTimeoutsRef.current.push(flashTimeout)
          }, timeMs)

          animationTimeoutsRef.current.push(resolveTimeout)
        })

        const decodeCompleteTimeout = window.setTimeout(() => {
          if (runTokenRef.current !== runToken || !canRunRef.current) {
            return
          }

          clearScrambleInterval()
          setCells(buildResolvedCells())
          phaseRef.current = 'locked'
          setPhase('locked')
          setLockOnActive(true)

          const lockTimeout = window.setTimeout(() => {
            if (runTokenRef.current !== runToken || !canRunRef.current) {
              return
            }

            setLockOnActive(false)
            phaseRef.current = 'dematerializing'
            setPhase('dematerializing')

            const dematerializeTimeout = window.setTimeout(() => {
              if (runTokenRef.current !== runToken) {
                return
              }

              phaseRef.current = 'idle'
              resetVisualState()

              if (canRunRef.current) {
                scheduleNextIdentRef.current()
              }
            }, DEMATERIALIZE_DURATION_MS)

            animationTimeoutsRef.current.push(dematerializeTimeout)
          }, LOCKED_DURATION_MS)

          animationTimeoutsRef.current.push(lockTimeout)
        }, DECODE_DURATION_MS)

        animationTimeoutsRef.current.push(decodeCompleteTimeout)
      }, MATERIALIZE_DURATION_MS)

      animationTimeoutsRef.current.push(materializeTimeout)
    }, delayMs)
  }

  useEffect(() => {
    cancelActiveSequenceRef.current = cancelActiveSequence
    scheduleNextIdentRef.current = scheduleNextIdent
  })

  useEffect(() => {
    const handleResize = () => {
      setViewportEligible(getViewportEligible())
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handleMotionChange = () => {
      setReducedMotion(mediaQuery.matches)
    }

    handleMotionChange()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMotionChange)
      return () => mediaQuery.removeEventListener('change', handleMotionChange)
    }

    mediaQuery.addListener(handleMotionChange)
    return () => mediaQuery.removeListener(handleMotionChange)
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      setDocumentVisible(getDocumentVisible())
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    canRunRef.current = canRun

    if (!canRun) {
      clearScheduledTimeout()

      if (phaseRef.current !== 'idle') {
        cancelActiveSequenceRef.current('recurring')
      }

      return
    }

    scheduleNextIdentRef.current()
  }, [canRun, reducedMotion])

  useEffect(() => {
    if (isAudioPlaying) {
      return
    }

    clearScheduledTimeout()

    if (phaseRef.current !== 'idle') {
      cancelActiveSequenceRef.current('recurring')
    }
  }, [isAudioPlaying])

  useEffect(() => {
    return () => {
      clearScheduledTimeout()
      clearScrambleInterval()
      clearAnimationTimeouts()
    }
  }, [])

  if (phase === 'idle' || !viewportEligible) {
    return null
  }

  return (
    <div className={`station-ident-overlay station-ident-overlay--${phase}`} aria-hidden="true">
      <div className={`station-ident-overlay__word${lockOnActive ? ' station-ident-overlay__word--lock-on' : ''}`}>
        <span className="station-ident-overlay__scanline" />
        {cells.map((cell, index) => {
          const className = [
            'station-ident-overlay__cell',
            cell.resolved ? 'station-ident-overlay__cell--resolved' : 'station-ident-overlay__cell--scrambling',
            cell.flashing ? 'station-ident-overlay__cell--flash' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <span key={index} className={className}>
              {cell.glyph}
            </span>
          )
        })}
        <span className="station-ident-overlay__underline" />
      </div>
    </div>
  )
}

export default StationIdentOverlay