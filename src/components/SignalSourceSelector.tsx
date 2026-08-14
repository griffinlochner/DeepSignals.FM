import type { SignalSource, SignalSourceGroup } from '../app/playerTypes'

type SignalSourceSelectorProps = {
  value: string
  signals?: SignalSource[]
  groups?: SignalSourceGroup[]
  onChange: (value: string) => void
}

function SignalOptions({ signals }: { signals: SignalSource[] }) {
  return signals.map((signal) => (
    <option key={signal.id} value={signal.id} disabled={signal.disabled}>
      {signal.label}
    </option>
  ))
}

function SignalSourceSelector({ value, signals = [], groups = [], onChange }: SignalSourceSelectorProps) {
  const optionCount = signals.length + groups.reduce((count, group) => count + group.signals.length, 0)

  return (
    <div className="signal-source-selector">
      <select
        className="signal-source-selector__select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Signal source"
        disabled={optionCount === 0}
      >
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            <SignalOptions signals={group.signals} />
          </optgroup>
        ))}
        <SignalOptions signals={signals} />
      </select>
    </div>
  )
}

export default SignalSourceSelector
