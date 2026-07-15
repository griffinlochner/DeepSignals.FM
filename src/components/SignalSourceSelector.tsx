import type { SignalSource } from '../app/playerTypes'

type SignalSourceSelectorProps = {
  value: string
  signals: SignalSource[]
  onChange: (value: string) => void
}

function SignalSourceSelector({ value, signals, onChange }: SignalSourceSelectorProps) {
  return (
    <label className="signal-source-selector">
      <span className="signal-source-selector__label">Signal source</span>
      <select
        className="signal-source-selector__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select signal</option>
        {signals.map((signal) => (
          <option key={signal.id} value={signal.id}>
            {signal.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default SignalSourceSelector
