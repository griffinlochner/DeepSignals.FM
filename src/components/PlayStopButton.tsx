type PlayStopButtonProps = {
  isPlaying: boolean
  isLoading?: boolean
  isDisabled: boolean
  onToggle: () => void
}

function PlayStopButton({ isPlaying, isLoading = false, isDisabled, onToggle }: PlayStopButtonProps) {
  const isButtonDisabled = isDisabled || isLoading

  return (
    <button
      className="play-stop-button"
      disabled={isButtonDisabled}
      onClick={onToggle}
      aria-label={isLoading ? 'Loading playback' : isPlaying ? 'Stop playback' : 'Start playback'}
    >
      {isLoading ? 'LOAD' : isPlaying ? 'STOP' : 'PLAY'}
    </button>
  )
}

export default PlayStopButton
