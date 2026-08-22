type VolumeControlProps = {
  value: number;
  onChange: (value: number) => void;
};

function VolumeControl({ value, onChange }: VolumeControlProps) {
  const volumePercent = `${Math.max(0, Math.min(value, 1)) * 100}%`;

  return (
    <label className="volume-control">
      <input
        className="volume-control__range"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        style={{ "--volume-percent": volumePercent } as React.CSSProperties}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label="Volume"
      />
    </label>
  );
}

export default VolumeControl;
