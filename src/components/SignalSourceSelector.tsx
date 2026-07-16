import type { SignalSource } from '../app/playerTypes'

type SignalSourceSelectorProps = {
  value: string
  signals: SignalSource[]
  onChange: (value: string) => void
}

function SignalSourceSelector({ value, signals, onChange }: SignalSourceSelectorProps) {
  return (
    <div className="signal-source-selector">
      <select
        className="signal-source-selector__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Signal source"
      >
        <option value="">Select signal</option>
        {signals.map((signal) => (
          <option key={signal.id} value={signal.id}>
            {signal.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default SignalSourceSelector
