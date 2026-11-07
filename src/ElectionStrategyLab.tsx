import {useEffect,useRef,useState} from 'react'
import {fetchStrategyPreview,type ElectionProjection,type StrategyPreview} from './lib/elections'
import './ElectionStrategyLab.css'

interface Props {
 matchId:string
 userId:string
 policy:number
 projection:ElectionProjection
 serverDay:string
 active:boolean
 campaignOpen:boolean
 blocked?:boolean
}
const signed=(n:number,decimals=0)=>
  (n>0?'+':'')+n.toFixed(decimals)

export default function ElectionStrategyLab({
 matchId,userId,policy,projection,serverDay,active,campaignOpen,blocked=false
}:Props){
 const [preview,setPreview]=useState<StrategyPreview|null>(null)
 const [error,setError]=useState('')
 const [running,setRunning]=useState(false)
 const revision=useRef(0)
 // Any current-party, rival, campaign, user, calendar or match mutation
 // invalidates the comparison, including a late response to the old world.
 const projectionKey=JSON.stringify(projection)
 useEffect(()=>{
  revision.current++
  setPreview(null);setError('');setRunning(false)
  return ()=>{revision.current++}
 },[matchId,userId,policy,serverDay,projectionKey,active,campaignOpen])
 async function simulate(){
  if(running||blocked||!active||!campaignOpen)return
  const request=++revision.current
  setRunning(true);setError('');setPreview(null)
  try{
   const next=await fetchStrategyPreview(matchId,userId,policy)
   if(request!==revision.current)return
   setPreview(next)
  }catch{
   if(request===revision.current)
    setError('No se pudo calcular el escenario. Comprueba que la campaña sigue abierta.')
  }finally{
   if(request===revision.current)setRunning(false)
  }
 }
 const meBefore=preview?.current.parties.find(p=>p.userId===userId)
 const meAfter=preview?.hypothetical.parties.find(p=>p.userId===userId)
 return <details className="strategy-lab" aria-label="Laboratorio electoral">
  <summary>Proyección electoral · comparar programas</summary>
  <p className="muted">Calcula con el servidor cómo cambiaría la proyección
   de 100 escaños si tu partido adoptase el programa seleccionado.
   No registra una campaña, no cambia tu programa ni concede escaños.</p>
  <p>Programa propuesto: <strong>{policy}/100</strong></p>
  <button type="button" onClick={()=>{void simulate()}}
   disabled={!active||!campaignOpen||blocked||running}>
   {running?'Simulando…':'Calcular proyección'}
  </button>
  {!active && <p className="muted">Disponible después de iniciar la partida.</p>}
  {active&&!campaignOpen && <p className="muted">La campaña está congelada: no se admiten nuevos escenarios.</p>}
  {error&&<p role="alert">{error}</p>}
  {preview&&meBefore&&meAfter&&<div className="strategy-lab-results" role="status">
   <p className="eyebrow">ESCENARIO HIPOTÉTICO · {preview.serverDay} UTC</p>
   <div className="strategy-lab-summary">
    <div><span>Tu voto: actual / escenario</span>
     <strong>{meBefore.voteSharePct.toFixed(2)}% / {meAfter.voteSharePct.toFixed(2)}%</strong>
     <small>{signed(meAfter.voteSharePct-meBefore.voteSharePct,2)} puntos porcentuales</small></div>
    <div><span>Tus escaños: actual / escenario</span>
     <strong>{meBefore.seats} / {meAfter.seats}</strong>
     <small>{signed(meAfter.seats-meBefore.seats)} escaños</small></div>
   </div>
   <h4>Reparto hipotético por circunscripción</h4>
   <div className="strategy-lab-districts">
    {preview.hypothetical.districts?.map(district=>{
     const original=preview.current.districts?.find(d=>d.code===district.code)
     const before=original?.parties.find(p=>p.userId===userId)?.seats??0
     const after=district.parties.find(p=>p.userId===userId)?.seats??0
     return <div key={district.code}><span>{district.label}</span>
       <strong>{before} → {after} <small>({signed(after-before)})</small></strong>
     </div>
    })}
   </div>
   <p className="muted">Comparación calculada en el mismo instante con el
    modelo electoral vigente. No son votos reales, resultados certificados
    ni una garantía sobre las urnas futuras. Para aplicar el programa usa
    «Publicar programa» en el apartado superior.</p>
  </div>}
 </details>
}
