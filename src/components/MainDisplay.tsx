function MainDisplay() {
  return (
    <section
      style={{
        border: '1px solid rgba(121, 255, 242, 0.3)',
        background: 'rgba(1, 1, 4, 0.78)',
        padding: '24px',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 0 30px rgba(57, 255, 20, 0.12)',
      }}
    >
      <p style={{ margin: 0, color: '#39ff14', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        NO ACTIVE TRANSMISSION
      </p>
      <h2 style={{ margin: '12px 0 0', fontSize: '1.35rem', color: '#d8fff7' }}>AWAITING SIGNAL SOURCE</h2>
    </section>
  )
}

export default MainDisplay
