import type {
  AudioAnalysisGraphDetails,
  AudioAnalysisStatus,
  AudioReactiveSnapshot,
} from '../app/playerTypes'
import './audioAnalysisDiagnostics.css'

type AudioAnalysisDiagnosticsProps = {
  status: AudioAnalysisStatus
  snapshot: AudioReactiveSnapshot
  graphDetails: AudioAnalysisGraphDetails
  errorMessage: string | null
  diagnosticsPublishHz: number
  analysisCalculationMode: 'requestAnimationFrame'
}

type MeterRowProps = {
  label: string
  value: number
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
  graphDetails,
  errorMessage,
  diagnosticsPublishHz,
  analysisCalculationMode,
}: AudioAnalysisDiagnosticsProps) {
  return (
    <aside className="audio-analysis-diagnostics" aria-label="Audio analysis diagnostics">
      <header className="audio-analysis-diagnostics__header">
        <p className="audio-analysis-diagnostics__title">DEV · AUDIO ANALYSIS</p>
        <p className="audio-analysis-diagnostics__status" data-status={status}>
          {status.toUpperCase()}
        </p>
      </header>

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

      <section className="audio-analysis-diagnostics__meters" aria-label="Live analysis values">
        <MeterRow label="Energy" value={snapshot.energy} />
        <MeterRow label="Smoothed" value={snapshot.smoothedEnergy} />
        <MeterRow label="Bass" value={snapshot.bass} />
        <MeterRow label="Mids" value={snapshot.mids} />
        <MeterRow label="Highs" value={snapshot.highs} />
        <MeterRow label="Transient" value={snapshot.transient} />
      </section>
    </aside>
  )
}

export default AudioAnalysisDiagnostics
