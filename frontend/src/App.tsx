import { useEffect, useState } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('checking…')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setApiStatus(data.status))
      .catch(() => setApiStatus('unreachable'))
  }, [])

  return (
    <main>
      <h1>Nosh</h1>
      <p>API status: {apiStatus}</p>
    </main>
  )
}

export default App
