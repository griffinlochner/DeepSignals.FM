import { useEffect } from 'react'
import ReactivityLabShell from './ReactivityLabShell'

function ReactivityLabPage() {
  useEffect(() => {
    document.documentElement.classList.add('reactivity-lab-page')
    document.body.classList.add('reactivity-lab-page')
    document.getElementById('root')?.classList.add('reactivity-lab-page')

    return () => {
      document.documentElement.classList.remove('reactivity-lab-page')
      document.body.classList.remove('reactivity-lab-page')
      document.getElementById('root')?.classList.remove('reactivity-lab-page')
    }
  }, [])

  return <ReactivityLabShell />
}

export default ReactivityLabPage
