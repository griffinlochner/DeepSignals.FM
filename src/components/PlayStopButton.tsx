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
      data-state={isLoading ? "loading" : isPlaying ? "stop" : "play"}
      disabled={isButtonDisabled}
      onClick={onToggle}
      aria-label={isLoading ? "Loading playback" : isPlaying ? "Pause" : "Play"}
    >
      {isLoading ? (
        "LOAD"
      ) : (
        <span className="play-stop-button__icon" aria-hidden="true">
          {isPlaying ? "❚❚" : "▶"}
        </span>
      )}
    </button>
  )
}

export default PlayStopButton
