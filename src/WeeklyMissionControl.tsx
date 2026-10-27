import { useEffect, useMemo, useState } from 'react'
import type { MatchWorld, MatchCalendar } from './lib/multiplayer'
import type {PublicLanguage} from './lib/publicLanguage'
import { fetchMatchCalendar, matchError } from './lib/multiplayer'
import { fetchParliamentState, type ParliamentState } from './lib/parliament'
import { buildWeeklyMission, type WeeklyAction } from './lib/weeklyCommand'
import './WeeklyMissionControl.css'

interface Props {
  world: MatchWorld
  userId: string
  language?:PublicLanguage
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

export default function WeeklyMissionControl({ world, userId, onSelect, language='es' }: Props) {
  const en=language==='en'
  const t=(es:string,english:string)=>en?english:es
  const descriptionEn:Readonly<Record<WeeklyAction,string>>={signed:'SIGNED POLICY',expired:'DEADLINE CLOSED',vote:'YOUR VOTE NEEDED','awaiting-votes':'VOTE RECORDED · TALLY OPEN',sign:'CABINET · SIGNATURE NEEDED','awaiting-signature':'APPROVED · AWAITING SIGNATURE',propose:'CABINET · PROPOSE A BILL',stance:'RECORD YOUR POSITION','awaiting-proposal':'AWAITING CABINET PROPOSAL'}
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
        setError(t('No se pudo sincronizar el estado parlamentario: ','Unable to sync parliamentary state: ')+matchError(reason))
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
  return <section className="weekly-mission" aria-label={t('Sala de operaciones legislativas','Legislative operations centre')}>
    <div className="weekly-mission-top">
      <div>
        <p className="eyebrow">{t('MANDATO SEMANAL · INFORMACIÓN VERIFICADA POR EL SERVIDOR','WEEKLY MANDATE · SERVER-VERIFIED INFORMATION')}</p>
        <h2>{t('Operaciones legislativas','Legislative operations')}</h2>
        <p className="muted">{t('El voto, la postura y la firma del Gobierno son actos distintos. Una noticia publicada no implica una ley aprobada.','A vote, a party position and an official cabinet signature are separate acts. A published article does not mean a law has passed.')}</p>
      </div>
      <button type="button" className="weekly-mission-refresh"
        disabled={pending} onClick={()=>setRefresh(x=>x+1)}>{t('Sincronizar estado','Sync state')}</button>
    </div>
    {pending&&!mission&&<p role="status">{t('Consultando calendario y Parlamento…','Loading calendar and Parliament…')}</p>}
    {error&&<p role="alert" className="editorial-alert">{error}</p>}
    {mission&&!current&&<p role="status" className="weekly-mission-warning">
      {t('El calendario ha cambiado. Sincroniza para obtener las acciones del nuevo día.','The political day has changed. Sync to view the new day’s actions.')}
    </p>}
    {mission&&<div className="weekly-mission-content">
      <div className="weekly-mission-numbers" aria-label={t('Progreso legislativo semanal','Weekly legislative progress')}>
        <div><span>{t('EXPEDIENTES EDITORIALES','EDITORIAL DOSSIERS')}</span><strong>{mission.available} / {mission.expected}</strong></div>
        <div><span>{t('TUS POSTURAS','YOUR POSITIONS')}</span><strong>{mission.stances} / {mission.available}</strong></div>
        <div><span>{t('TUS VOTOS','YOUR VOTES')}</span><strong>{mission.votes}</strong></div>
        <div><span>{t('LEYES EJECUTADAS','ENACTED LAWS')}</span><strong>{mission.signed} / {mission.expected}</strong></div>
      </div>
      {!mission.published?<p role="status" className="weekly-mission-warning">
        {t('Esta semana no tiene diez expedientes aprobados. El programa ficticio inicial es independiente de las noticias y no se contará como publicación editorial.','This week does not have ten approved editorial dossiers. The fictional founding programme is separate from news and never counts as a published weekly slate.')}
      </p>:mission.overdue?<p className="weekly-mission-warning">
        {t('Semana cerrada el','Week closed on')} {mission.friday} UTC. {t('Consulta el acta certificada en Seguimiento de la legislatura.','Consult the certified parliamentary record in Legislature accountability.')}
      </p>:<p className="weekly-mission-deadline">
        {t('Fecha institucional','Official date')} {mission.date}. {t('Cierre de decisiones: viernes','Decision deadline: Friday')} {mission.friday} UTC.
        {' '}{mission.pending} {t('asuntos requieren una acción de tu partido.','items require your party to act.')}
      </p>}
      {actionable&&mission.next&&<button type="button" className="weekly-mission-next"
        onClick={()=>onSelect(mission.next!.dossier.id)}>
        {t('Abrir siguiente asunto:','Open next item:')} {mission.next.dossier.title}
      </button>}
      {mission.rows.length>0&&<ol className="weekly-mission-rows">
        {mission.rows.map(({dossier,action,hasStance,hasVote,bill})=>
          <li key={dossier.id+':'+dossier.version}>
            <button type="button" disabled={!actionable}
              onClick={()=>onSelect(dossier.id)}>
              <span><strong>{dossier.title}</strong>{en&&<small>Original dossier title (Spanish)</small>}
                <small>{dossier.category} · {hasStance?t('postura registrada','position recorded'):t('sin postura','no position')}
                  {' · '}{hasVote?t('voto registrado','vote recorded'):t('sin voto','no vote')}
                  {bill ? ' · '+bill.status.toUpperCase() : ''}</small>
              </span>
              <span className="weekly-mission-status">{en?descriptionEn[action]:descriptions[action]}</span>
            </button>
          </li>)}
      </ol>}
    </div>}
  </section>
}
