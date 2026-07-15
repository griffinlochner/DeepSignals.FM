type PlayStopButtonProps = {
  isPlaying: boolean
  isDisabled: boolean
  onToggle: (playing: boolean) => void
}

function PlayStopButton({ isPlaying, isDisabled, onToggle }: PlayStopButtonProps) {
  return (
    <button
      className="play-stop-button"
      disabled={isDisabled}
      onClick={() => onToggle(!isPlaying)}
      aria-label={isPlaying ? 'Stop playback' : 'Start playback'}
    >
      {isPlaying ? 'STOP' : 'PLAY'}
    </button>
  )
}

export default PlayStopButton
