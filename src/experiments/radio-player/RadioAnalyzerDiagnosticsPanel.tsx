import type { AnalyzerDiagnostics } from './useExternalRadioController'

type RadioAnalyzerDiagnosticsPanelProps = {
  diagnostics: AnalyzerDiagnostics
}

function format(value: number, digits = 4) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0000'
}

function formatStateChangeTimestamp(timestampMs: number) {
  const elapsedSeconds = Math.max(0, (performance.now() - timestampMs) / 1000)
  return `${elapsedSeconds.toFixed(2)}s ago`
}

function RadioAnalyzerDiagnosticsPanel({ diagnostics }: RadioAnalyzerDiagnosticsPanelProps) {
  const latest = diagnostics.latest
  const sampleCount = diagnostics.rollingSamples.length
  const spikes = diagnostics.spikes.slice(0, 8)
  const recentSamples = diagnostics.rollingSamples.slice(-28)

  const hasValidationIssue =
    latest.hasNanOrInfinity || latest.hasNegativeRange || latest.hasLargeFrameGap

  return (
    <section className="radio-analyzer-diagnostics" aria-label="Analyzer diagnostics">
      <h3>Analyzer Diagnostics (DEV)</h3>

      <div className="radio-analyzer-diagnostics__grid">
        <Metric label="time-domain RMS" value={format(latest.timeDomainRms)} />
        <Metric label="time-domain peak" value={format(latest.timeDomainPeak)} />
        <Metric label="bass energy" value={format(latest.bassEnergy)} />
        <Metric label="midrange energy" value={format(latest.midrangeEnergy)} />
        <Metric label="treble energy" value={format(latest.trebleEnergy)} />
        <Metric
          label="nonzero FFT bins"
          value={`${format(latest.nonZeroFftBinRatio * 100, 1)}% (${format(latest.nonZeroFftBinRatio, 3)})`}
        />
        <Metric label="raw depth input" value={format(latest.rawDepthInput)} />
        <Metric label="normalized depth" value={format(latest.normalizedDepth)} />
        <Metric label="final smoothed depth" value={format(latest.finalSmoothedDepth)} />
        <Metric
          label="rolling baseline min/max"
          value={`${format(latest.rollingDepthMin)} / ${format(latest.rollingDepthMax)}`}
        />
        <Metric label="normalization range" value={format(latest.normalizationRange)} />
        <Metric label="quiet gate" value={latest.quietGateActive ? 'active' : 'open'} />
        <Metric label="frame delta time" value={`${format(latest.frameDeltaMs, 2)} ms`} />
        <Metric label="audio readyState" value={`${latest.audioReadyState}`} />
        <Metric label="audio networkState" value={`${latest.audioNetworkState}`} />
        <Metric label="AudioContext state" value={latest.audioContextState} />
        <Metric label="audio currentTime" value={`${format(latest.audioCurrentTime, 2)} s`} />
        <Metric label="reconnect attempt count" value={`${latest.reconnectAttemptCount}`} />
      </div>

      <p className={hasValidationIssue ? 'radio-analyzer-diagnostics__flag radio-analyzer-diagnostics__flag--warn' : 'radio-analyzer-diagnostics__flag'}>
        Validation flags: NaN/Infinity={latest.hasNanOrInfinity ? 'yes' : 'no'}; negative range={latest.hasNegativeRange ? 'yes' : 'no'}; large frame-gap={latest.hasLargeFrameGap ? 'yes' : 'no'}
      </p>

      <details>
        <summary>Rolling sample buffer (last ~8s, {sampleCount} samples)</summary>
        <div className="radio-analyzer-diagnostics__table-wrap">
          <table>
            <thead>
              <tr>
                <th>t</th>
                <th>RMS</th>
                <th>Bass</th>
                <th>Raw</th>
                <th>Norm</th>
                <th>Final</th>
                <th>Range</th>
                <th>Gate</th>
                <th>dt</th>
                <th>ctx</th>
              </tr>
            </thead>
            <tbody>
              {recentSamples.map((sample) => (
                <tr key={`${sample.timestampMs}-${sample.frameDeltaMs}`}>
                  <td>{formatStateChangeTimestamp(sample.timestampMs)}</td>
                  <td>{format(sample.timeDomainRms, 3)}</td>
                  <td>{format(sample.bassEnergy, 3)}</td>
                  <td>{format(sample.rawDepthInput, 3)}</td>
                  <td>{format(sample.normalizedDepth, 3)}</td>
                  <td>{format(sample.finalSmoothedDepth, 3)}</td>
                  <td>{format(sample.normalizationRange, 3)}</td>
                  <td>{sample.quietGateActive ? 'yes' : 'no'}</td>
                  <td>{format(sample.frameDeltaMs, 1)}</td>
                  <td>{sample.audioContextState}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details>
        <summary>Spike events ({spikes.length})</summary>
        {spikes.length === 0 ? <p>No spike events captured yet.</p> : null}
        <ul>
          {spikes.map((spike) => (
            <li key={spike.id}>
              <strong>{spike.reason}</strong> · stage={spike.stage} · {formatStateChangeTimestamp(spike.timestampMs)} · captured {spike.samples.length} buffered samples
            </li>
          ))}
        </ul>
      </details>
    </section>
  )
}

type MetricProps = {
  label: string
  value: string
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className="radio-analyzer-diagnostics__metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default RadioAnalyzerDiagnosticsPanel
