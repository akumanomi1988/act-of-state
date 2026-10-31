import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import DemoApp from './DemoApp'
import PlayerGuide from './PlayerGuide'
import ServiceStatus from './ServiceStatus'
import EditorialApp from './EditorialApp'
import MultiplayerApp from './MultiplayerApp'
import './styles.css'
import './mobile-focus.css'
import './mobile-drilldown.css'
import './game-shell.css'
import './game-guide.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.location.pathname === '/demo' ? <DemoApp /> : window.location.pathname === '/guide' ? <PlayerGuide /> : window.location.pathname === '/status' ? <ServiceStatus /> : window.location.pathname === '/editorial' ? <EditorialApp /> :
    window.location.pathname === '/multiplayer' ? <MultiplayerApp /> : <App />}</StrictMode>
)
