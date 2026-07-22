import { useEffect, useState } from 'react'
import type {
  AudioAnalysisStatus,
  AudioPlaybackStatus,
  AudioReactiveSnapshot,
  ReactivePreviewTelemetry,
} from '../app/playerTypes'
import PanelChevronIcon from './PanelChevronIcon'
import './signalTelemetryPanel.css'

type SignalTelemetryPanelProps = {
  analysisStatus: AudioAnalysisStatus
  playbackStatus: AudioPlaybackStatus
  getLatestSnapshot: () => AudioReactiveSnapshot
  getLatestReactiveTelemetry?: () => ReactivePreviewTelemetry
}

type MeterRowProps = {
  label: string
  value: number
}

const ZERO_SNAPSHOT: AudioReactiveSnapshot = {
  energy: 0,
  smoothedEnergy: 0,
  bass: 0,
  kickPulse: 0,
  kickPulseAcceptedEvent: false,
  kickPulseAcceptedEventCount: 0,
  kickPulseAcceptedEventSequence: 0,
  bassPulse: 0,
  mids: 0,
  highs: 0,
  transient: 0,
  isActive: false,
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '0.000'
  }

  return value.toFixed(3)
}

function formatCompactNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) {
    return '--'
  }

  return value.toFixed(digits)
}

function formatMilliseconds(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return '--'
  }

  return `${Math.round(value)} ms`
}

function formatBpm(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return '--'
  }

  return `${Math.round(value)}`
}

function formatDepthPair(current: number, target: number) {
  return `${formatCompactNumber(current)} / ${formatCompactNumber(target)}`
}

const ZERO_REACTIVE_TELEMETRY: ReactivePreviewTelemetry = {
  selectedReactiveBehavior: 'Chill',
  reactivePreviewEnabled: false,
  reactiveIsolationEnabled: false,
  reactiveTimingAuthorityActive: false,
  musicAuthorityActive: false,
  motionGateOpen: false,
  authoredCyclicBreathingEnabled: false,
  authoredDepthContribution: 0,
  authoredAmbientGeometryContribution: 0,
  depthSustainedContribution: 0,
  kickDrivenDepthContribution: 0,
  depthPulseContribution: 0,
  depthCombinedBeforeClamp: 0,
  configuredDepthMinimum: 0,
  configuredDepthMaximum: 0,
  depthFinalAfterClamp: 0,
  finalDisplacementScale: 0,
  kickPulse: 0,
  kickPulseAcceptedEvent: false,
  kickPulseAcceptedEventCount: 0,
  kickPulseAcceptedEventSequence: 0,
  rendererKickEventCountLastSeen: 0,
  rendererKickEventSequenceLastSeen: 0,
  sourceBpm: null,
  beatIntervalMs: null,
  acceptedEventMinimumIntervalMs: 0,
  millisecondsSincePreviousAcceptedEvent: 0,
  acceptedEventRatePerSecondRecent: 0,
  smoothedEnergy: 0,
  sectionIntensity: 0,
  fullOnPhase: 'n/a',
  fullOnTargetDepth: 0,
  fullOnCurrentDepth: 0,
  millisecondsSinceAcceptedKickEvent: 0,
  inactivityReturnActive: false,
  kickBreathEnvelope: 0,
  fullOnLowTargetDepth: 0,
  fullOnHighTargetDepth: 0,
  fullOnAttackDurationMs: 0,
  fullOnReleaseDurationMs: 0,
  kickBloomEnvelope: 0,
  hueEventStride: 1,
  hueEventStepAppliedDegrees: 0,
  reactiveHueTargetDegrees: 0,
  reactiveHueOffsetDegrees: 0,
  authoredBaseSaturation: 1,
  authoredPeriodicSaturationContribution: 0,
  reactiveSaturationMultiplier: 1,
  finalSaturation: 1,
  grayscaleFilterActive: false,
  saturationBloomMultiplier: 1,
  saturationCap: 2,
  authoredBaseGlow: 1,
  reactiveKickBloom: 0,
  reactiveKickSurfaceGlowBloom: 0,
  globalGlowMultiplier: 1,
  saturationMultiplier: 1,
  globalLightMultiplier: 1,
  finalGlobalGlowMultiplier: 1,
  finalSurfaceGlowMultiplier: 1,
  surfaceGlowMultiplier: 1,
  authoredHueCycleSuppressed: false,
  authoredSaturationCycleSuppressed: false,
  authoredGlobalGlowCycleSuppressed: false,
  transientAccent: 0,
  geometryMotionActive: false,
}

function MeterRow({ label, value }: MeterRowProps) {
  const normalized = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

  return (
    <div className="signal-telemetry-panel__meter-row">
      <p className="signal-telemetry-panel__meter-label">{label}</p>
      <div className="signal-telemetry-panel__meter-track" aria-hidden="true">
        <span className="signal-telemetry-panel__meter-fill" style={{ width: `${normalized * 100}%` }} />
      </div>
      <p className="signal-telemetry-panel__meter-value">{formatNumber(normalized)}</p>
    </div>
  )
}

function SignalTelemetryPanel({
  analysisStatus,
  playbackStatus,
  getLatestSnapshot,
  getLatestReactiveTelemetry = () => ZERO_REACTIVE_TELEMETRY,
}: SignalTelemetryPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [snapshot, setSnapshot] = useState<AudioReactiveSnapshot>(ZERO_SNAPSHOT)
  const [reactiveTelemetry, setReactiveTelemetry] = useState<ReactivePreviewTelemetry>(ZERO_REACTIVE_TELEMETRY)
  const [layout, setLayout] = useState<{ left: number; width: number } | null>(null)

  useEffect(() => {
    const publish = () => {
      setSnapshot(getLatestSnapshot())
      setReactiveTelemetry(getLatestReactiveTelemetry())
    }

    const initialPublishHandle = window.setTimeout(publish, 0)
    const intervalHandle = window.setInterval(publish, 100)

    return () => {
      window.clearTimeout(initialPublishHandle)
      window.clearInterval(intervalHandle)
    }
  }, [getLatestReactiveTelemetry, getLatestSnapshot])

  useEffect(() => {
    const updateLayout = () => {
      const playerPanel = document.querySelector('.floating-player-panel') as HTMLElement | null

      if (!playerPanel) {
        setLayout(null)
        return
      }

      const rect = playerPanel.getBoundingClientRect()
      setLayout({
        left: rect.left,
        width: rect.width,
      })
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)

    const playerPanel = document.querySelector('.floating-player-panel') as HTMLElement | null
    const observer = playerPanel ? new ResizeObserver(updateLayout) : null
    if (observer && playerPanel) {
      observer.observe(playerPanel)
    }

    return () => {
      window.removeEventListener('resize', updateLayout)
      observer?.disconnect()
    }
  }, [])

  let statusLabel = 'Paused'

  if (playbackStatus === 'playing') {
    statusLabel = analysisStatus === 'running' ? 'Listening' : 'Signal unavailable'
  }

  const reactiveState = reactiveTelemetry.musicAuthorityActive ? 'MUSIC' : 'AUTH'
  const behaviorLabel = reactiveTelemetry.selectedReactiveBehavior === 'Full On' ? 'FULL' : 'CHILL'
  const analysisAvailabilityLabel = snapshot.isActive ? 'LIVE' : 'NO-SIG'
  const kickIntervalLabel = formatMilliseconds(
    reactiveTelemetry.millisecondsSincePreviousAcceptedEvent > 0
      ? reactiveTelemetry.millisecondsSincePreviousAcceptedEvent
      : reactiveTelemetry.beatIntervalMs,
  )

  const technicalRows: Array<{ label: string; value: string; numeric?: boolean }> = [
    { label: 'State', value: `${behaviorLabel} · ${reactiveState}` },
    { label: 'Signal', value: analysisAvailabilityLabel },
    { label: 'BPM', value: formatBpm(reactiveTelemetry.sourceBpm), numeric: true },
    { label: 'Kick Int', value: kickIntervalLabel },
    {
      label: 'Evt Rate',
      value: `${formatCompactNumber(reactiveTelemetry.acceptedEventRatePerSecondRecent, 2)}/s`,
      numeric: true,
    },
    {
      label: 'Depth C/T',
      value: formatDepthPair(reactiveTelemetry.depthFinalAfterClamp, reactiveTelemetry.fullOnTargetDepth),
      numeric: true,
    },
    {
      label: 'Hue Off/Step',
      value: `${formatCompactNumber(reactiveTelemetry.reactiveHueOffsetDegrees, 1)} / ${formatCompactNumber(reactiveTelemetry.hueEventStepAppliedDegrees, 1)}`,
      numeric: true,
    },
    {
      label: 'Sat/Glow',
      value: `${formatCompactNumber(reactiveTelemetry.finalSaturation, 2)} / ${formatCompactNumber(reactiveTelemetry.finalGlobalGlowMultiplier, 2)}`,
      numeric: true,
    },
  ]

  return (
    <aside
      className="signal-telemetry-panel"
      aria-label="Signal telemetry"
      data-collapsed={collapsed ? 'true' : 'false'}
      style={layout ? { left: `${layout.left}px`, width: `${layout.width}px` } : undefined}
    >
      <div className="signal-telemetry-panel__surface">
        <header className="signal-telemetry-panel__header">
          <p className="signal-telemetry-panel__title">SIGNAL TELEMETRY</p>
          <div className="signal-telemetry-panel__header-actions">
            <p className="signal-telemetry-panel__status">{statusLabel}</p>
            <button
              type="button"
              className="signal-telemetry-panel__toggle"
              aria-label={collapsed ? 'Expand Signal Telemetry' : 'Collapse Signal Telemetry'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
            >
              <PanelChevronIcon collapsed={collapsed} expandDirection="up" />
            </button>
          </div>
        </header>

        {!collapsed ? (
          <div className="signal-telemetry-panel__body">
            <section className="signal-telemetry-panel__meters" aria-label="Signal levels">
              <MeterRow label="Energy" value={snapshot.energy} />
              <MeterRow label="Bass" value={snapshot.bass} />
              <MeterRow label="Kick" value={snapshot.kickPulse} />
              <MeterRow label="Mids" value={snapshot.mids} />
              <MeterRow label="Highs" value={snapshot.highs} />
            </section>

            <section className="signal-telemetry-panel__tech" aria-label="Technical telemetry">
              {technicalRows.map((row) => (
                <div key={row.label} className="signal-telemetry-panel__tech-row">
                  <p className="signal-telemetry-panel__tech-label">{row.label}</p>
                  <p
                    className={[
                      'signal-telemetry-panel__tech-value',
                      row.numeric ? 'signal-telemetry-panel__tech-value--numeric' : '',
                    ].join(' ').trim()}
                  >
                    {row.value}
                  </p>
                </div>
              ))}
            </section>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

export default SignalTelemetryPanel
