import { useEffect, useMemo, useState } from 'react'
import type { MatchWorld, MatchCalendar } from './lib/multiplayer'
import { fetchMatchCalendar, matchError } from './lib/multiplayer'
import { fetchParliamentState, type ParliamentState } from './lib/parliament'
import { buildWeeklyMission, type WeeklyAction } from './lib/weeklyCommand'
import './WeeklyMissionControl.css'

interface Props {
  world: MatchWorld
  userId: string
  onSelect: (dossierId: string) => void
}

const descriptions: Record<WeeklyAction,string> = {
  signed:'MEDIDA FIRMADA',
  expired:'PLAZO CERRADO',
  vote:'TU VOTO PENDIENTE',
  'awaiting-votes':'YA HAS VOTADO · ESCRUTINIO ABIERTO',
  sign:'GOBIERNO · FIRMA PENDIENTE',
  'awaiting-signature':'APROBADA · ESPERA FIRMA',
  propose:'GOBIERNO · PROPONER LEY',
  stance:'FIJA TU POSTURA',
  'awaiting-proposal':'ESPERA PROPUESTA DE GOBIERNO'
}

export default function WeeklyMissionControl({ world, userId, onSelect }: Props) {
  const [calendar,setCalendar]=useState<MatchCalendar|null>(null)
  const [parliament,setParliament]=useState<ParliamentState|null>(null)
  const [pending,setPending]=useState(true)
  const [error,setError]=useState('')
  const [stale,setStale]=useState(false)
  const [refresh,setRefresh]=useState(0)
  const matchId=world.match.id
  useEffect(()=>{
    let alive=true
    let revision=0
    setCalendar(null);setParliament(null);setPending(true);setError('');setStale(false)
    async function load() {
      const id=++revision
      try {
        const [nextCalendar,nextParliament]=await Promise.all([
          fetchMatchCalendar(matchId),fetchParliamentState(matchId)
        ])
        if(!alive||id!==revision)return
        setCalendar(nextCalendar)
        setParliament(nextParliament)
        setStale(false)
        setError('')
      } catch(reason) {
        if(!alive||id!==revision)return
        setStale(true)
        setError('No se pudo sincronizar el estado parlamentario: '+matchError(reason))
      } finally {
        if(alive&&id===revision)setPending(false)
      }
    }
    void load()
    const interval=window.setInterval(()=>void load(),15_000)
    return ()=>{alive=false;revision++;window.clearInterval(interval)}
  },[matchId,userId,refresh])
  const mission=useMemo(()=>calendar&&parliament
    ?buildWeeklyMission(world,parliament,calendar,userId):null,
    [world,calendar,parliament,userId])
  // A snapshot from a previous day is no longer a trustworthy action queue.
  const current=mission?.date===world.gameDay
  const actionable=!!mission&&!stale&&current&&!mission.overdue
  return <section className="weekly-mission" aria-label="Sala de operaciones legislativas">
    <div className="weekly-mission-top">
      <div>
        <p className="eyebrow">MANDATO SEMANAL · INFORMACIÓN VERIFICADA POR EL SERVIDOR</p>
        <h2>Operaciones legislativas</h2>
        <p className="muted">El voto, la postura y la firma del Gobierno son actos distintos.
          Una noticia publicada no implica una ley aprobada.</p>
      </div>
      <button type="button" className="weekly-mission-refresh"
        disabled={pending} onClick={()=>setRefresh(x=>x+1)}>Sincronizar estado</button>
    </div>
    {pending&&!mission&&<p role="status">Consultando calendario y Parlamento…</p>}
    {error&&<p role="alert" className="editorial-alert">{error}</p>}
    {mission&&!current&&<p role="status" className="weekly-mission-warning">
      El calendario ha cambiado. Sincroniza para obtener las acciones del nuevo día.
    </p>}
    {mission&&<div className="weekly-mission-content">
      <div className="weekly-mission-numbers" aria-label="Progreso legislativo semanal">
        <div><span>EXPEDIENTES EDITORIALES</span><strong>{mission.available} / {mission.expected}</strong></div>
        <div><span>TUS POSTURAS</span><strong>{mission.stances} / {mission.available}</strong></div>
        <div><span>TUS VOTOS</span><strong>{mission.votes}</strong></div>
        <div><span>LEYES EJECUTADAS</span><strong>{mission.signed} / {mission.expected}</strong></div>
      </div>
      {!mission.published?<p role="status" className="weekly-mission-warning">
        Esta semana no tiene diez expedientes aprobados. El programa ficticio inicial
        es independiente de las noticias y no se contará como publicación editorial.
      </p>:mission.overdue?<p className="weekly-mission-warning">
        Semana cerrada el {mission.friday} UTC. Consulta el acta certificada en
        Seguimiento de la legislatura.
      </p>:<p className="weekly-mission-deadline">
        Fecha institucional {mission.date}. Cierre de decisiones: viernes {mission.friday} UTC.
        {' '}{mission.pending} asuntos requieren una acción de tu partido.
      </p>}
      {actionable&&mission.next&&<button type="button" className="weekly-mission-next"
        onClick={()=>onSelect(mission.next!.dossier.id)}>
        Abrir siguiente asunto: {mission.next.dossier.title}
      </button>}
      {mission.rows.length>0&&<ol className="weekly-mission-rows">
        {mission.rows.map(({dossier,action,hasStance,hasVote,bill})=>
          <li key={dossier.id+':'+dossier.version}>
            <button type="button" disabled={!actionable}
              onClick={()=>onSelect(dossier.id)}>
              <span><strong>{dossier.title}</strong>
                <small>{dossier.category} · {hasStance?'postura registrada':'sin postura'}
                  {' · '}{hasVote?'voto registrado':'sin voto'}
                  {bill ? ' · '+bill.status.toUpperCase() : ''}</small>
              </span>
              <span className="weekly-mission-status">{descriptions[action]}</span>
            </button>
          </li>)}
      </ol>}
    </div>}
  </section>
}
