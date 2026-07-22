type PanelChevronIconProps = {
  collapsed: boolean
  expandDirection?: 'up' | 'down'
}

function PanelChevronIcon({ collapsed, expandDirection = 'down' }: PanelChevronIconProps) {
  const pointUp = collapsed ? expandDirection === 'up' : expandDirection !== 'up'

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {pointUp ? (
        <>
          <path d="M4 12.25L8 8.25L12 12.25" />
          <path d="M4 9.75L8 5.75L12 9.75" />
        </>
      ) : (
        <>
          <path d="M4 6.25L8 10.25L12 6.25" />
          <path d="M4 3.75L8 7.75L12 3.75" />
        </>
      )}
    </svg>
  )
}

export default PanelChevronIcon
