import { useEffect, useState } from 'react'
import type {
  AudioAnalysisGraphDetails,
  AudioAnalysisStatus,
  AudioReactiveSnapshot,
  ReactivePreviewTelemetry,
} from '../app/playerTypes'
import './audioAnalysisDiagnostics.css'

type BassPulseDebugReadout = {
  fastBass: number
  slowBass: number
  bassDelta: number
  fastEnergy: number
  slowEnergy: number
  energyDelta: number
  combinedCandidate: number
  postThresholdCandidate: number
  threshold: number
  warmupActive: boolean
  warmupRemainingMs: number
  warmupFramesRemaining: number
  cooldownRemainingMs: number
}

type KickPulseDebugReadout = {
  lowBandSpectralFlux: number
  positiveEnergyRise: number
  combinedCandidate: number
  adaptiveBaseline: number
  adaptiveThreshold: number
  postThresholdCandidate: number
  acceptedKickEvent: boolean
  acceptedKickEventCount: number
  warmupActive: boolean
  warmupRemainingMs: number
  warmupFramesRemaining: number
  cooldownRemainingMs: number
}

type AudioAnalysisDiagnosticsProps = {
  status: AudioAnalysisStatus
  snapshot: AudioReactiveSnapshot
  bassPulseDebug: BassPulseDebugReadout
  kickPulseDebug: KickPulseDebugReadout
  graphDetails: AudioAnalysisGraphDetails
  errorMessage: string | null
  diagnosticsPublishHz: number
  analysisCalculationMode: 'requestAnimationFrame'
  reactiveDiagnosticsEnabled?: boolean
  getReactivePreviewTelemetry?: (() => ReactivePreviewTelemetry) | null
}

type MeterRowProps = {
  label: string
  value: number
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

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '0.000'
  }

  return value.toFixed(3)
}

function MeterRow({ label, value }: MeterRowProps) {
  const normalized = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))

  return (
    <div className="audio-analysis-diagnostics__meter-row">
      <p className="audio-analysis-diagnostics__meter-label">{label}</p>
      <div className="audio-analysis-diagnostics__meter-track" aria-hidden="true">
        <span className="audio-analysis-diagnostics__meter-fill" style={{ width: `${normalized * 100}%` }} />
      </div>
      <p className="audio-analysis-diagnostics__meter-value">{formatNumber(normalized)}</p>
    </div>
  )
}

function AudioAnalysisDiagnostics({
  status,
  snapshot,
  bassPulseDebug,
  kickPulseDebug,
  graphDetails,
  errorMessage,
  diagnosticsPublishHz,
  analysisCalculationMode,
  reactiveDiagnosticsEnabled = false,
  getReactivePreviewTelemetry = null,
}: AudioAnalysisDiagnosticsProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [reactiveTelemetry, setReactiveTelemetry] = useState<ReactivePreviewTelemetry>(ZERO_REACTIVE_TELEMETRY)

  useEffect(() => {
    if (!reactiveDiagnosticsEnabled || !getReactivePreviewTelemetry) {
      return
    }

    const publish = () => {
      setReactiveTelemetry(getReactivePreviewTelemetry())
    }

    const initialPublishHandle = window.setTimeout(publish, 0)
    const intervalHandle = window.setInterval(publish, 50)

    return () => {
      window.clearTimeout(initialPublishHandle)
      window.clearInterval(intervalHandle)
    }
  }, [getReactivePreviewTelemetry, reactiveDiagnosticsEnabled])

  const displayedReactiveTelemetry = reactiveDiagnosticsEnabled ? reactiveTelemetry : ZERO_REACTIVE_TELEMETRY

  return (
    <aside className="audio-analysis-diagnostics" aria-label="Audio analysis diagnostics" data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="audio-analysis-diagnostics__surface">
        <header className="audio-analysis-diagnostics__header">
          <p className="audio-analysis-diagnostics__title">DEV · AUDIO ANALYSIS</p>
          <div className="audio-analysis-diagnostics__header-actions">
            <p className="audio-analysis-diagnostics__status" data-status={status}>
              {status.toUpperCase()}
            </p>
            <button
              type="button"
              className="audio-analysis-diagnostics__toggle"
              aria-label={collapsed ? 'Expand audio analysis diagnostics' : 'Collapse audio analysis diagnostics'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((current) => !current)}
            >
              {collapsed ? 'EXPAND' : 'COLLAPSE'}
            </button>
          </div>
        </header>

        {!collapsed ? (
          <div className="audio-analysis-diagnostics__body">
            <div className="audio-analysis-diagnostics__meta-grid">
              <p>Context: {graphDetails.contextState ?? 'n/a'}</p>
              <p>Sample Rate: {graphDetails.sampleRate ? `${Math.round(graphDetails.sampleRate)} Hz` : 'n/a'}</p>
              <p>FFT: {graphDetails.fftSize ?? 'n/a'}</p>
              <p>Bins: {graphDetails.frequencyBinCount ?? 'n/a'}</p>
              <p>Smoothing: {graphDetails.smoothingTimeConstant?.toFixed(2) ?? 'n/a'}</p>
              <p>Range: {graphDetails.minDecibels ?? 'n/a'} to {graphDetails.maxDecibels ?? 'n/a'} dB</p>
              <p>Calc Loop: {analysisCalculationMode}</p>
              <p>UI Publish: {diagnosticsPublishHz} Hz</p>
            </div>

            {errorMessage ? (
              <p className="audio-analysis-diagnostics__error" role="status">
                {errorMessage}
              </p>
            ) : null}

            <section className="audio-analysis-diagnostics__readout" aria-label="Reactive behavior state">
              <p>Reactive Behavior: {displayedReactiveTelemetry.selectedReactiveBehavior}</p>
              <p>Reactive Isolation: {displayedReactiveTelemetry.reactiveIsolationEnabled ? 'On' : 'Off'}</p>
              <p>Music Authority: {displayedReactiveTelemetry.musicAuthorityActive ? 'On' : 'Off'}</p>
              <p>Motion Gate: {displayedReactiveTelemetry.motionGateOpen ? 'Open' : 'Closed'}</p>
            </section>

            <section className="audio-analysis-diagnostics__meters" aria-label="Live analysis values">
              <MeterRow label="Energy" value={snapshot.energy} />
              <MeterRow label="Smoothed" value={snapshot.smoothedEnergy} />
              <MeterRow label="Bass" value={snapshot.bass} />
              <MeterRow label="Kick Pulse" value={snapshot.kickPulse} />
              <MeterRow label="Bass Pulse" value={snapshot.bassPulse} />
              <MeterRow label="Mids" value={snapshot.mids} />
              <MeterRow label="Highs" value={snapshot.highs} />
              <MeterRow label="Transient" value={snapshot.transient} />
            </section>

            <section className="audio-analysis-diagnostics__readout" aria-label="Low-frequency onset tuning values">
              <p>Bass Onset</p>
              <p>
                fast {formatNumber(bassPulseDebug.fastBass)} | slow {formatNumber(bassPulseDebug.slowBass)} | delta{' '}
                {formatNumber(bassPulseDebug.bassDelta)} | Efast {formatNumber(bassPulseDebug.fastEnergy)} | Eslow{' '}
                {formatNumber(bassPulseDebug.slowEnergy)} | Edelta {formatNumber(bassPulseDebug.energyDelta)}
              </p>
              <p>
                pre {formatNumber(bassPulseDebug.combinedCandidate)} | post{' '}
                {formatNumber(bassPulseDebug.postThresholdCandidate)} | th {formatNumber(bassPulseDebug.threshold)} | warmup{' '}
                {bassPulseDebug.warmupActive ? 'on' : 'off'} ({Math.round(bassPulseDebug.warmupRemainingMs)}ms,{' '}
                {bassPulseDebug.warmupFramesRemaining}f) | cd {Math.round(bassPulseDebug.cooldownRemainingMs)}ms
              </p>
            </section>

            {reactiveDiagnosticsEnabled ? (
              <section className="audio-analysis-diagnostics__readout" aria-label="Kick pulse tuning values">
                <p>Kick Pulse</p>
                <p>
                  flux {formatNumber(kickPulseDebug.lowBandSpectralFlux)} | erise {formatNumber(kickPulseDebug.positiveEnergyRise)} | cand{' '}
                  {formatNumber(kickPulseDebug.combinedCandidate)} | base {formatNumber(kickPulseDebug.adaptiveBaseline)} | th{' '}
                  {formatNumber(kickPulseDebug.adaptiveThreshold)}
                </p>
                <p>
                  post {formatNumber(kickPulseDebug.postThresholdCandidate)} | event{' '}
                  {kickPulseDebug.acceptedKickEvent ? 'on' : 'off'} | count {kickPulseDebug.acceptedKickEventCount} | warmup{' '}
                  {kickPulseDebug.warmupActive ? 'on' : 'off'} ({Math.round(kickPulseDebug.warmupRemainingMs)}ms,{' '}
                  {kickPulseDebug.warmupFramesRemaining}f) | cd {Math.round(kickPulseDebug.cooldownRemainingMs)}ms
                </p>
              </section>
            ) : null}

            {reactiveDiagnosticsEnabled ? (
              <section className="audio-analysis-diagnostics__readout" aria-label="Reactive preview renderer values">
          <p>Reactive Preview</p>
          <p>
            active {displayedReactiveTelemetry.reactivePreviewEnabled ? 'on' : 'off'} | geom{' '}
            {displayedReactiveTelemetry.geometryMotionActive ? 'on' : 'off'} | gate{' '}
            {displayedReactiveTelemetry.motionGateOpen ? 'on' : 'off'} | auth{' '}
            {displayedReactiveTelemetry.reactiveTimingAuthorityActive ? 'music' : 'authored'} | iso{' '}
            {displayedReactiveTelemetry.reactiveIsolationEnabled ? 'on' : 'off'}
          </p>
          <p>
            bpm {displayedReactiveTelemetry.sourceBpm ?? 'n/a'} | beat{' '}
            {displayedReactiveTelemetry.beatIntervalMs ? `${Math.round(displayedReactiveTelemetry.beatIntervalMs)}ms` : 'n/a'} | minInt{' '}
            {Math.round(displayedReactiveTelemetry.acceptedEventMinimumIntervalMs)}ms | prevInt{' '}
            {Math.round(displayedReactiveTelemetry.millisecondsSincePreviousAcceptedEvent)}ms | rate{' '}
            {formatNumber(displayedReactiveTelemetry.acceptedEventRatePerSecondRecent)}/s
          </p>
          <p>
            smE {formatNumber(displayedReactiveTelemetry.smoothedEnergy)} | section{' '}
            {formatNumber(displayedReactiveTelemetry.sectionIntensity)}
          </p>
          <p>
            event {displayedReactiveTelemetry.kickPulseAcceptedEvent ? 'on' : 'off'} | count{' '}
            {displayedReactiveTelemetry.kickPulseAcceptedEventCount} | phase {displayedReactiveTelemetry.fullOnPhase} | idle{' '}
            {Math.round(displayedReactiveTelemetry.millisecondsSinceAcceptedKickEvent)}ms
          </p>
          <p>
            breath {formatNumber(displayedReactiveTelemetry.kickBreathEnvelope)} | lowD{' '}
            {formatNumber(displayedReactiveTelemetry.fullOnLowTargetDepth)} | highD{' '}
            {formatNumber(displayedReactiveTelemetry.fullOnHighTargetDepth)} | targetD{' '}
            {formatNumber(displayedReactiveTelemetry.fullOnTargetDepth)} | currentD{' '}
            {formatNumber(displayedReactiveTelemetry.fullOnCurrentDepth)} | atk {Math.round(displayedReactiveTelemetry.fullOnAttackDurationMs)}ms | rel{' '}
            {Math.round(displayedReactiveTelemetry.fullOnReleaseDurationMs)}ms | return{' '}
            {displayedReactiveTelemetry.inactivityReturnActive ? 'on' : 'off'}
          </p>
          <p>
            breath {displayedReactiveTelemetry.authoredCyclicBreathingEnabled ? 'on' : 'off'} | depthA{' '}
            {formatNumber(displayedReactiveTelemetry.authoredDepthContribution)} | ambientA{' '}
            {formatNumber(displayedReactiveTelemetry.authoredAmbientGeometryContribution)}
          </p>
          <p>
            depthS {formatNumber(displayedReactiveTelemetry.depthSustainedContribution)} | kickDepth{' '}
            {formatNumber(displayedReactiveTelemetry.kickDrivenDepthContribution)} | depthP{' '}
            {formatNumber(displayedReactiveTelemetry.depthPulseContribution)} | pre{' '}
            {formatNumber(displayedReactiveTelemetry.depthCombinedBeforeClamp)} | post{' '}
            {formatNumber(displayedReactiveTelemetry.depthFinalAfterClamp)}
          </p>
          <p>
            min {formatNumber(displayedReactiveTelemetry.configuredDepthMinimum)} | max{' '}
            {formatNumber(displayedReactiveTelemetry.configuredDepthMaximum)} | disp{' '}
            {formatNumber(displayedReactiveTelemetry.finalDisplacementScale)}
          </p>
          <p>
            hueT {formatNumber(displayedReactiveTelemetry.reactiveHueTargetDegrees)}deg | hue
            {formatNumber(displayedReactiveTelemetry.reactiveHueOffsetDegrees)}deg | bloom{' '}
            {formatNumber(displayedReactiveTelemetry.kickBloomEnvelope)} | sat x
            {formatNumber(displayedReactiveTelemetry.saturationBloomMultiplier)} | gGlow x
            {formatNumber(displayedReactiveTelemetry.globalGlowMultiplier)} | gLight x
            {formatNumber(displayedReactiveTelemetry.globalLightMultiplier)} | surface x
            {formatNumber(displayedReactiveTelemetry.surfaceGlowMultiplier)} | tr{' '}
            {formatNumber(displayedReactiveTelemetry.transientAccent)}
          </p>
          <p>
            hueStride {displayedReactiveTelemetry.hueEventStride} | hueStep{' '}
            {formatNumber(displayedReactiveTelemetry.hueEventStepAppliedDegrees)}deg | gray{' '}
            {displayedReactiveTelemetry.grayscaleFilterActive ? 'on' : 'off'}
          </p>
          <p>
            satBase {formatNumber(displayedReactiveTelemetry.authoredBaseSaturation)} | satCycle{' '}
            {formatNumber(displayedReactiveTelemetry.authoredPeriodicSaturationContribution)} | satReactive x
            {formatNumber(displayedReactiveTelemetry.reactiveSaturationMultiplier)} | satFinal{' '}
            {formatNumber(displayedReactiveTelemetry.finalSaturation)} | satCap {formatNumber(displayedReactiveTelemetry.saturationCap)}
          </p>
          <p>
            glowBase {formatNumber(displayedReactiveTelemetry.authoredBaseGlow)} | kickGlow{' '}
            {formatNumber(displayedReactiveTelemetry.reactiveKickBloom)} | kickSurface{' '}
            {formatNumber(displayedReactiveTelemetry.reactiveKickSurfaceGlowBloom)} | glowFinal x
            {formatNumber(displayedReactiveTelemetry.finalGlobalGlowMultiplier)} | surfaceFinal x
            {formatNumber(displayedReactiveTelemetry.finalSurfaceGlowMultiplier)}
          </p>
          <p>
            hueCycle {displayedReactiveTelemetry.authoredHueCycleSuppressed ? 'suppressed' : 'authored'} | satCycle{' '}
            {displayedReactiveTelemetry.authoredSaturationCycleSuppressed ? 'suppressed' : 'authored'} | glowCycle{' '}
            {displayedReactiveTelemetry.authoredGlobalGlowCycleSuppressed ? 'suppressed' : 'authored'}
          </p>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  )
}

export default AudioAnalysisDiagnostics
