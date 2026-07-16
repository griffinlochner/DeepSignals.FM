type VolumeControlProps = {
  value: number
  onChange: (value: number) => void
}

function VolumeControl({ value, onChange }: VolumeControlProps) {
  return (
    <label className="volume-control">
      <input
        className="volume-control__range"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label="Volume"
      />
    </label>
  )
}

export default VolumeControl
