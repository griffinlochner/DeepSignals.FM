type DefaultDisplayFrameProps = {
  children: React.ReactNode
  displayMode: string
}

function DefaultDisplayFrame({ children }: DefaultDisplayFrameProps) {
  return (
    <div className="default-display-frame">
      {children}
    </div>
  )
}

export default DefaultDisplayFrame
