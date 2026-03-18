import React from 'react'
import { Overlay } from './Overlay'
import { Settings } from './Settings'
import { MainWindow } from './MainWindow'

function App(): JSX.Element {
  const params = new URLSearchParams(window.location.search)
  if (params.get('overlay') === 'true') return <Overlay />
  if (params.get('settings') === 'true') return <Settings />
  return <MainWindow />
}

export default App
