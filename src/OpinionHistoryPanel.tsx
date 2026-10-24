import {useEffect,useMemo,useState} from 'react'
import {
 fetchOpinionHistory,pollSegments,voteChange,
 type OpinionHistory
} from './lib/opinionPolls'
import {matchError} from './lib/multiplayer'

export default function OpinionHistoryPanel({matchId,userId}:{
 matchId:string,userId:string
}) {
 const [days,setDays]=useState<7|30|90>(30)
 const [history,setHistory]=useState<OpinionHistory|null>(null)
 const [selected,setSelected]=useState('')
 const [error,setError]=useState('')
 useEffect(()=>{
  let alive=true,revision=0
  setHistory(null);setSelected('');setError('')
  const refresh=async()=>{
   const request=++revision
   try{
    const result=await fetchOpinionHistory(matchId,days)
    if(!alive||revision!==request)return
    setHistory(result);setError('')
   }catch(reason){
    if(alive&&revision===request)setError(matchError(reason))
   }
  }
  void refresh()
  const timer=window.setInterval(()=>void refresh(),60000)
  return()=>{alive=false;revision++;window.clearInterval(timer)}
 },[matchId,userId,days])
 const latest=history?.polls[history.polls.length-1]
 const parties=latest?.parties??[]
 const partyId=parties.some(p=>p.userId===selected)?selected:
  parties.some(p=>p.userId===userId)?userId:parties[0]?.userId??''
 const current=parties.find(p=>p.userId===partyId)
 const delta=history?voteChange(history.polls,partyId):null
 const paths=useMemo(()=>history?
  pollSegments(history.polls,partyId,history.fromDay,history.serverDay):[],
  [history,partyId])
 return <section className="opinion-observatory" aria-label="Observatorio electoral histórico">
  <p className="eyebrow">HISTORIA ELECTORAL · MUESTRA SINTÉTICA</p>
  <h3>Observatorio de intención de voto</h3>
  <p className="muted">Capturas oficiales de la simulación cada día UTC, conservadas sin
   recalcularlas. No son encuestas reales ni resultados electorales certificados.
   Los días sin captura permanecen vacíos.</p>
  <fieldset className="opinion-period">
   <legend>Periodo histórico</legend>
   {([7,30,90] as const).map(value=><label key={value}>
    <input type="radio" name={'poll-days-'+matchId} checked={days===value}
     onChange={()=>setDays(value)}/>{value} días</label>)}
  </fieldset>
  {!history&&!error&&<p role="status">Consultando las mediciones…</p>}
  {error&&<p role="alert" className="editorial-alert">{error}</p>}
  {history&&<>
   <div className="opinion-metrics">
    <div><span>MEDICIONES REGISTRADAS</span>
     <strong>{history.recordedDays} / {history.expectedDays}</strong></div>
    <div><span>ÚLTIMA CAPTURA</span>
     <strong>{latest?.day??'Todavía no disponible'}</strong></div>
   </div>
   {history.recordedDays===0?<p role="status">El servidor aún no ha capturado
    datos para esta partida. El calendario iniciará el registro automático.</p>
   : <>
    <label className="opinion-selector">Partido que quieres analizar
     <select value={partyId} onChange={event=>setSelected(event.target.value)}>
      {parties.map(party=><option key={party.userId} value={party.userId}>
       {party.partyName}</option>)}
     </select>
    </label>
    {current&&<div className="opinion-summary">
     <strong>{current.partyName}: {current.voteSharePct.toFixed(2)} %</strong>
     <span>{delta===null?'Sin tendencia comparable':
      (delta>0?'+':'')+delta.toFixed(2)+' puntos desde la primera captura del periodo'}</span>
    </div>}
    <svg className="opinion-plot" viewBox="0 0 300 82" role="img"
     aria-label={current?'Histórico de intención de voto de '+current.partyName:'Gráfico sin datos'}>
     <line x1="8" x2="292" y1="72" y2="72" stroke="currentColor" opacity=".3"/>
     <line x1="8" x2="292" y1="10" y2="10" stroke="currentColor" opacity=".2"/>
     {paths.map((path,i)=><path key={i} d={path} fill="none"
      stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/>)}
    </svg>
    <p className="muted opinion-gap-note">{paths.length===0?
     'Se necesitan dos capturas de días consecutivos para trazar un tramo.':
     'Las líneas se interrumpen cuando faltan mediciones.'}</p>
    <div className="opinion-records">
     <h4>Registro cronológico verificable</h4>
     <table><thead><tr><th>Fecha UTC</th><th>Apoyo</th><th>Escaños estimados</th></tr></thead>
      <tbody>{history.polls.map(poll=>{
       const p=poll.parties.find(p=>p.userId===partyId)
       return <tr key={poll.day}><td>{poll.day}</td>
        <td>{p?p.voteSharePct.toFixed(2)+' %':'Sin dato'}</td>
        <td>{p?p.seats:'—'}</td></tr>
      })}</tbody></table>
    </div>
    {latest&&latest.districts.length>0&&<details className="opinion-regions">
     <summary>Distribución territorial de la última medición ({latest.districts.length} distritos)</summary>
     <ul>{latest.districts.map(district=>{
      const first=[...district.parties].sort((a,b)=>b.voteSharePct-a.voteSharePct)[0]
      return <li key={district.code}><strong>{district.label}</strong>
       <span>{first?first.partyName+' · '+first.voteSharePct.toFixed(2)+' %':'Sin datos'}</span>
       <small>{district.seats} escaños · {district.households} hogares</small>
      </li>
     })}</ul>
    </details>}
   </>}
  </>}
 </section>
}
