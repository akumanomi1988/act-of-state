import { useEffect, useState } from 'react'
import {parsePublicLanguage, publicRoute, updatePublicLanguage} from './lib/publicLanguage'
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
  const [language,setLanguage]=useState<'es'|'en'>(()=>{
    return parsePublicLanguage(window.location.search)
  })
  const en=language==='en'
  const t=(es:string,english:string)=>en?english:es
  function chooseLanguage(next:'es'|'en') {
    updatePublicLanguage(next)
    setLanguage(next)
  }
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
          <div className="brand-caption">{t('ESTADO DEL SERVICIO','SERVICE STATUS')}</div>
        </div>
      </div>
      <nav className="header-end" aria-label={t('Navegación principal','Main navigation')}>
        <a className="text-button" href="/">{t('Gobierno','Government')}</a>
        <a className="text-button" href="/multiplayer">{t('Multijugador','Multiplayer')}</a>
        <a className="text-button" href={publicRoute("/guide",language)}>{t('Manual','Guide')}</a>
      </nav>
    </header>
    <main className="service-status-main" lang={language}>
      <div role="group" aria-label={t('Idioma del estado','Status language')}>
        <button type="button" aria-pressed={!en} onClick={()=>chooseLanguage('es')}>Español</button>
        <button type="button" aria-pressed={en} onClick={()=>chooseLanguage('en')}>English</button>
      </div>
      <p className="eyebrow">{t('DIAGNÓSTICO PÚBLICO · SIN DATOS DE CUENTA','PUBLIC DIAGNOSTICS · NO ACCOUNT DATA')}</p>
      <h1>{t('Estado técnico del juego','Game technical status')}</h1>
      <p className="muted"> {t('Comprueba la versión pública y la disponibilidad básica del servicio de acceso. No es una comprobación de tu correo, de tu sesión ni del funcionamiento completo de una partida.','Check the public release and basic sign-in availability. This is not a test of your email delivery, your personal session or a complete game transaction.')}</p>
      <button type="button" className="primary-button" disabled={busy}
        onClick={()=>setRefresh(count=>count+1)}>
        {busy?t('Comprobando…','Checking…'):t('Comprobar de nuevo','Check again')}
      </button>
      {!snapshot&&<p role="status">{t('Recuperando información pública…','Retrieving public status…')}</p>}
      {snapshot&&<>
        <div className="service-status-grid" role="list" aria-label={t('Comprobaciones técnicas','Technical checks')}>
          <div role="listitem" className="service-status-cell">
            <strong>{t('Versión de la web','Website revision')}</strong>
            <span>{snapshot.frontend==='ready'?t('Identificada','Identified'):t('No verificable','Unverified')}</span>
            <small>{snapshot.release?.commit
              ?t('Revisión ','Revision ')+snapshot.release.commit.slice(0,12)
              :t('No consta una revisión publicada verificable','No verifiable published revision is available')}</small>
          </div>
          <div role="listitem" className="service-status-cell">
            <strong>{t('Servicio de acceso','Sign-in service')}</strong>
            <span>{snapshot.auth==='available'
              ?t('Endpoint de autenticación accesible','Authentication endpoint reachable'):t('Disponibilidad no verificada','Availability not verified')}</span>
            <small>{t('La entrega real de correos no se comprueba aquí.','Email delivery is not tested here.')}</small>
          </div>
          <div role="listitem" className="service-status-cell">
            <strong>{t('Reglas del cliente','Client model rules')}</strong>
            <span>{snapshot.release
              ?snapshot.release.models.elections:t('No verificables','Not verified')}</span>
            <small>{t('El modelo declarado no certifica por sí solo el estado de la base.','The declared model does not confirm the database condition.')}</small>
          </div>
        </div>
        {snapshot.issue&&<p role="alert" className="service-status-warning">{t(snapshot.issue,'Unable to identify the published game revision.')}</p>}
        {(snapshot.auth==='unverified'||snapshot.frontend==='unverified')&&
          <p role="status" className="service-status-warning">
            {t('Algunos servicios no se han podido comprobar. Reinténtalo o consulta el manual; no interpretes este resultado como una pérdida de tu partida.','Some services could not be verified. Retry or consult the guide; this does not mean your game has been lost.')}
          </p>}
        <p className="muted">{t('Última comprobación de este navegador:','Last browser check:')} {snapshot.checkedAt} UTC.</p>
      </>}
      <p className="service-status-help">{t('Si falla la conexión, conserva tu sesión y evita repetir una firma o un voto hasta volver a consultar el acta.','If you lose connection, keep your session and do not repeat a signature or vote before checking the official record.')}
        <a href={publicRoute('/guide',language)}>{t(' Consulta las instrucciones de recuperación.',' Read recovery instructions.')}</a></p>
    </main>
  </div>
}
