import { useEffect, useMemo, useState } from 'react'
import { fetchDiplomacy, type DiplomacyState } from './lib/diplomacy'
import type { DecisionEvent, Dossier } from './lib/types'
import './DiplomacyPanel.css'

interface Props {
  governmentId: string
  identity: string
  dossiers: Dossier[]
  events: DecisionEvent[]
  onSelect: (dossier:Dossier)=>void
  mode: 'solo' | 'parliament'
}
const zones=[
  {id:'europe',label:'Europa',dossier:'diplomacy-europe'},
  {id:'asia',label:'Asia',dossier:'diplomacy-asia'},
  {id:'usa',label:'Estados Unidos',dossier:'diplomacy-usa'}
] as const
const sign=(n:number)=>(n>0?'+':'')+n

export default function DiplomacyPanel({
  governmentId,identity,dossiers,events,onSelect,mode
}:Props) {
  const [state,setState]=useState<DiplomacyState|null>(null)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [revision,setRevision]=useState(0)
  const eventFingerprint=events.map(x=>x.id).join(',')
  useEffect(()=>{
    let alive=true
    setState(null);setError('');setLoading(true)
    void fetchDiplomacy(governmentId).then(next=>{
      if(alive){setState(next);setLoading(false)}
    }).catch(reason=>{
      if(alive){
        setError(reason instanceof Error?reason.message:'No se pudo consultar la diplomacia.')
        setLoading(false)
      }
    })
    return ()=>{alive=false}
  },[governmentId,identity,eventFingerprint,revision])
  const signedIds=useMemo(()=>new Set(events.map(e=>e.dossier_id)),[events])
  return <section className="diplomacy-panel" aria-label="Diplomacia y relaciones internacionales">
    <div className="diplomacy-heading">
      <div><p className="eyebrow">POLÍTICA EXTERIOR · ESTADO VERIFICADO</p>
        <h2>Diplomacia internacional</h2>
        <p className="muted">Tres regiones, acuerdos con consecuencias económicas y relaciones persistentes.
          Las puntuaciones son un modelo ficticio, no indicadores geopolíticos reales.</p></div>
      <button type="button" className="text-button" disabled={loading}
        onClick={()=>setRevision(n=>n+1)}>Actualizar relaciones</button>
    </div>
    {loading && <p role="status">Consultando relaciones firmadas…</p>}
    {error && <p role="alert">No se pudieron verificar las relaciones: {error}</p>}
    {state && <>
      <div className="diplomacy-grid">
        {zones.map((zone,i)=>{
          const bloc=state.blocs[i]
          const dossier=dossiers.find(d=>d.id===zone.dossier && d.version===1)
          const signed=signedIds.has(zone.dossier)
          return <div className="diplomacy-bloc" key={zone.id}>
            <h3>{zone.label}</h3>
            <div className="diplomacy-value"><strong>{bloc.relation}/100</strong><span>Relación bilateral</span></div>
            <div role="progressbar" aria-label={'Relación con '+zone.label}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={bloc.relation}
              className="diplomacy-track"><span style={{width:bloc.relation+'%'}} /></div>
            <p>Índice comercial: <strong>{bloc.tradeIndex}/200</strong></p>
            <p className="muted">{bloc.signedEffects} efectos diplomáticos firmados</p>
            {dossier && <button className="text-button" type="button"
              onClick={()=>onSelect(dossier)}>
              {signed?'Consultar acuerdo firmado':
                mode==='parliament'?'Debatir tratado en el Parlamento':'Negociar expediente'}
            </button>}
          </div>
        })}
      </div>
      <details className="diplomacy-history">
        <summary>Historial diplomático verificado ({state.recentEffects.length} efectos)</summary>
        {state.recentEffects.length===0?<p className="muted">Todavía no se han firmado acuerdos.</p>:
          <ol>{state.recentEffects.map((e,i)=><li key={e.eventId+':'+e.bloc+':'+i}>
            <strong>{e.title} · {zones.find(z=>z.id===e.bloc)?.label}</strong>
            <span>{e.choice}: relación {sign(e.relationDelta)};
              comercio {sign(e.tradeDelta)}</span>
          </li>)}</ol>}
      </details>
      <p className="muted">Los efectos se registran con la firma del Gobierno.
        En multijugador, el tratado necesita primero aprobación parlamentaria vinculante.</p>
    </>}
  </section>
}

