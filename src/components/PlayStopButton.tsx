type PlayStopButtonProps = {
  isPlaying: boolean
  isLoading?: boolean
  isDisabled: boolean
  onToggle: () => void
}

function PlayIcon() {
  return (
    <svg className="play-stop-button__icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M6 3.5 24 14 6 24.5Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg className="play-stop-button__icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M5 4h6v20H5zM17 4h6v20h-6z" />
    </svg>
  )
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
        isPlaying ? <PauseIcon /> : <PlayIcon />
      )}
    </button>
  )
}

export default PlayStopButton
