import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import EditorialApp from './EditorialApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>{window.location.pathname === '/editorial' ? <EditorialApp /> : <App />}</StrictMode>
)
