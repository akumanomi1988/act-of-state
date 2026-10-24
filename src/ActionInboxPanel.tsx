import {useEffect,useState} from 'react'
import {
  fetchActionInbox,markInboxRead,
  type ActionInbox,type ActionInboxItem,type InboxSection
} from './lib/actionInbox'
import {matchError} from './lib/multiplayer'

const destination:Record<InboxSection,string>={
  lobby:'match-lobby',dossiers:'match-dossiers',
  parliament:'match-dossiers',governance:'match-governance',
  campaign:'match-campaign',election:'match-election',history:'match-history'
}
export default function ActionInboxPanel({matchId,onNavigate}:{
  matchId:string
  onNavigate:(section:InboxSection,dossierId:string|null)=>void
}) {
  const [inbox,setInbox]=useState<ActionInbox|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState<string|null>(null)
  const [hideRead,setHideRead]=useState(false)
  const [revision,setRevision]=useState(0)

  useEffect(()=>{
    let alive=true
    let request=0
    setInbox(null);setError('')
    const refresh=async()=>{
      const current=++request
      try{
        const data=await fetchActionInbox(matchId)
        if(!alive||current!==request)return
        setInbox(data)
        setError('')
      }catch(reason){
        if(alive&&current===request)setError(matchError(reason))
      }
    }
    void refresh()
    const interval=window.setInterval(()=>void refresh(),15000)
    return()=>{alive=false;request++;window.clearInterval(interval)}
  },[matchId,revision])

  async function acknowledge(item:ActionInboxItem) {
    if(busy)return
    setBusy(item.key);setError('')
    try{
      await markInboxRead(matchId,item.key)
      // Mark as read only after authoritative RPC acknowledges the write.
      setRevision(v=>v+1)
    }catch(reason){setError(matchError(reason))}
    finally{setBusy(null)}
  }

  const shown=inbox?.items.filter(item=>!hideRead||!item.read)??[]
  return <section className="match-inbox" aria-label="Bandeja de actividad política">
    <div className="match-inbox-heading">
      <div><p className="eyebrow">AGENDA PERSONAL · RELOJ DEL SERVIDOR</p>
        <h2>Tu actividad política</h2></div>
      <strong aria-label="Avisos sin leer">{inbox?.unreadCount??'…'} sin leer</strong>
    </div>
    <p className="muted">Votaciones, posiciones, campañas y actas relevantes para tu partido.
      Los avisos leídos no sustituyen a las tareas pendientes.</p>
    <label className="match-inbox-filter">
      <input type="checkbox" checked={hideRead}
        onChange={event=>setHideRead(event.target.checked)}/>
      Mostrar solo avisos sin leer
    </label>
    {!inbox&&!error&&<p role="status">Consultando asuntos del partido…</p>}
    {error&&<p className="editorial-alert" role="alert">{error}</p>}
    {inbox&&shown.length===0&&<p role="status">No hay avisos en este filtro.</p>}
    {shown.length>0&&<ul className="match-inbox-list">{shown.map(item=>
      <li key={item.key} className={item.read?'inbox-read':'inbox-new'}>
        <div className="match-inbox-message">
          <strong>{item.title}</strong>
          <p>{item.detail}</p>
          <small>{item.kind==='action'?'ACCIÓN PENDIENTE':'NOVEDAD'} ·
            {' '}{item.read?'Leído':'Sin leer'}</small>
        </div>
        <div className="match-inbox-buttons">
          <button type="button" className="text-button" onClick={()=>{
            onNavigate(item.section,item.dossierId)
            const target=document.getElementById(destination[item.section])
            target?.scrollIntoView({block:'start',behavior:'smooth'})
          }}>Ir al asunto</button>
          {!item.read&&<button type="button" disabled={busy!==null}
            onClick={()=>void acknowledge(item)}>
            {busy===item.key?'Guardando…':'Marcar leído'}
          </button>}
        </div>
      </li>
    )}</ul>}
  </section>
}
