import type { Station } from '../app/types'

type SignalSourceSelectorProps = {
  value: string
  stations: Station[]
  onChange: (value: string) => void
}

function SignalSourceSelector({ value, stations, onChange }: SignalSourceSelectorProps) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.95rem' }}>
      <span>Signal source</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {stations.map((station) => (
          <option key={station.id} value={station.id}>
            {station.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default SignalSourceSelector
