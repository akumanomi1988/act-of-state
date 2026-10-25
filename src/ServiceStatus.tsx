import { useEffect, useState } from 'react'
import { publicAuthHealthUrl, readPublicRelease, type PublicRelease } from './lib/releaseStatus'
import './service-status.css'

interface Snapshot {
  release:PublicRelease|null
  frontend:'ready'|'unverified'
  auth:'available'|'unverified'
  issue:string|null
  checkedAt:string
}
/** Diagnostic only: an HTTP health response does not certify live login,
 *  database migration completion, active SMTP or real user transactions. */
export default function ServiceStatus() {
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null)
  const [busy,setBusy]=useState(false)
  const [refresh,setRefresh]=useState(0)
  useEffect(()=>{
    const controller=new AbortController()
    let alive=true
    setBusy(true)
    const read=async()=>{
      const authUrl=publicAuthHealthUrl(import.meta.env.VITE_SUPABASE_URL)
      const [releaseResult,authResult]=await Promise.allSettled([
        fetch('/release.json',{cache:'no-store',signal:controller.signal})
          .then(async response=>{
            if(!response.ok || !(response.headers.get('content-type')??'').includes('json'))
              throw new Error('RELEASE_MANIFEST_NOT_AVAILABLE')
            return readPublicRelease(await response.json())
          }),
        authUrl
          ?fetch(authUrl,{cache:'no-store',signal:controller.signal})
              .then(response=>{
                if(!response.ok)throw new Error('AUTH_PROBE_NOT_AVAILABLE')
                return true
              })
          :Promise.reject(new Error('AUTH_CONFIGURATION_NOT_AVAILABLE'))
      ])
      if(!alive)return
      const release=releaseResult.status==='fulfilled'?releaseResult.value:null
      setSnapshot({
        release,
        frontend:release ? 'ready':'unverified',
        auth:authResult.status==='fulfilled'?'available':'unverified',
        issue:releaseResult.status==='rejected'
          ?'No se puede confirmar qué versión del juego está publicada.':'',
        checkedAt:new Date().toISOString()
      })
      setBusy(false)
    }
    void read()
    return ()=>{alive=false;controller.abort()}
  },[refresh])
  return <div className="app-shell service-status">
    <header className="masthead">
      <div className="brand-group">
        <span className="brand-symbol" aria-hidden="true">A<span>／</span>S</span>
        <div>
          <div className="wordmark">ACT OF STATE</div>
          <div className="brand-caption">ESTADO DEL SERVICIO</div>
        </div>
      </div>
      <nav className="header-end" aria-label="Navegación principal">
        <a className="text-button" href="/">Gobierno</a>
        <a className="text-button" href="/multiplayer">Multijugador</a>
        <a className="text-button" href="/guide">Manual</a>
      </nav>
    </header>
    <main className="service-status-main">
      <p className="eyebrow">DIAGNÓSTICO PÚBLICO · SIN DATOS DE CUENTA</p>
      <h1>Estado técnico del juego</h1>
      <p className="muted">Comprueba la versión pública y la disponibilidad
        básica del servicio de acceso. No es una comprobación de tu correo,
        de tu sesión ni del funcionamiento completo de una partida.</p>
      <button type="button" className="primary-button" disabled={busy}
        onClick={()=>setRefresh(count=>count+1)}>
        {busy?'Comprobando…':'Comprobar de nuevo'}
      </button>
      {!snapshot&&<p role="status">Recuperando información pública…</p>}
      {snapshot&&<>
        <div className="service-status-grid" role="list" aria-label="Comprobaciones técnicas">
          <div role="listitem" className="service-status-cell">
            <strong>Versión de la web</strong>
            <span>{snapshot.frontend==='ready'?'Identificada':'No verificable'}</span>
            <small>{snapshot.release?.commit
              ?'Revisión '+snapshot.release.commit.slice(0,12)
              :'No consta una revisión publicada verificable'}</small>
          </div>
          <div role="listitem" className="service-status-cell">
            <strong>Servicio de acceso</strong>
            <span>{snapshot.auth==='available'
              ?'Endpoint de autenticación accesible':'Disponibilidad no verificada'}</span>
            <small>La entrega real de correos no se comprueba aquí.</small>
          </div>
          <div role="listitem" className="service-status-cell">
            <strong>Reglas del cliente</strong>
            <span>{snapshot.release
              ?snapshot.release.models.elections:'No verificables'}</span>
            <small>El modelo declarado no certifica por sí solo el estado de la base.</small>
          </div>
        </div>
        {snapshot.issue&&<p role="alert" className="service-status-warning">{snapshot.issue}</p>}
        {(snapshot.auth==='unverified'||snapshot.frontend==='unverified')&&
          <p role="status" className="service-status-warning">
            Algunos servicios no se han podido comprobar. Reinténtalo o consulta el manual;
            no interpretes este resultado como una pérdida de tu partida.
          </p>}
        <p className="muted">Última comprobación de este navegador: {snapshot.checkedAt} UTC.</p>
      </>}
      <p className="service-status-help">Si falla la conexión, conserva tu sesión y
        evita repetir una firma o un voto hasta volver a consultar el acta.
        <a href="/guide"> Consulta las instrucciones de recuperación.</a></p>
    </main>
  </div>
}
