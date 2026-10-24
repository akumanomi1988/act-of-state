import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PlayerGuide from './PlayerGuide'
import EditorialApp from './EditorialApp'
import MultiplayerApp from './MultiplayerApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.location.pathname === '/guide' ? <PlayerGuide /> : window.location.pathname === '/editorial' ? <EditorialApp /> :
    window.location.pathname === '/multiplayer' ? <MultiplayerApp /> : <App />}</StrictMode>
)
