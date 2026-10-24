import {useEffect,useState} from 'react'
import {fetchWeeklyAccountability,type WeeklyReport} from './lib/weeklyAccountability'
import {matchError} from './lib/multiplayer'
import {number} from './lib/format'

function ActSection({week}:{week:WeeklyReport}) {
  const act=week.fridayAct
  return <div className="accountability-act">
    {act ? <p className="week-note">
      <strong>Acta oficial del viernes:</strong> {act.decisions_resolved}
      {' '}decisiones de {act.dossiers_published} expedientes;
      {' '}tesoro {number(act.treasury_at_friday_m_eur)} M€
      {' '}({act.treasury_delta_m_eur>=0?'+':''}{number(act.treasury_delta_m_eur)} M€),
      {' '}aprobación {act.approval_at_friday}% y confianza {act.trust_at_friday}%.
    </p> : <p className="muted">El acta oficial se genera después del viernes UTC.
      Las cifras provisionales no sustituyen al cierre certificado.</p>}
    {week.elections.map(item=><p key={item.electionNo} className="week-note">
      Elección #{item.electionNo} · {item.certifiedOn} · nuevo gobierno:
      {' '}{item.winnerParty}
    </p>)}
  </div>
}

export default function WeeklyAccountabilityPanel({matchId}:{matchId:string}) {
  const [weeks,setWeeks]=useState<WeeklyReport[]>([])
  const [serverDay,setServerDay]=useState('')
  const [selected,setSelected]=useState('')
  const [pending,setPending]=useState(true)
  const [error,setError]=useState('')

  useEffect(()=>{
    let alive=true
    let revision=0
    setWeeks([]);setSelected('');setError('');setPending(true)
    async function refresh(){
      const current=++revision
      try {
        const result=await fetchWeeklyAccountability(matchId)
        if(!alive||current!==revision)return
        setWeeks(result.weeks)
        setServerDay(result.serverDay)
        setSelected(before=>result.weeks.some(w=>w.weekStart===before)?
          before:result.weeks[0]?.weekStart??'')
        setError('')
      } catch(reason) {
        if(alive&&current===revision)setError(matchError(reason))
      } finally {
        if(alive&&current===revision)setPending(false)
      }
    }
    void refresh()
    const interval=window.setInterval(()=>void refresh(),60000)
    return ()=>{alive=false;revision++;window.clearInterval(interval)}
  },[matchId])

  const chosen=weeks.find(week=>week.weekStart===selected)
  return <section className="weekly-accountability" aria-label="Seguimiento semanal de la legislatura">
    <p className="eyebrow">CONTROL DEMOCRÁTICO · DATOS DEL SERVIDOR</p>
    <h2>Seguimiento de la legislatura</h2>
    {pending&&!weeks.length&&<p role="status">Recuperando la actividad semanal…</p>}
    {error&&<p role="alert" className="editorial-alert">{error}</p>}
    {!pending&&!error&&!weeks.length&&<p>No hay semanas iniciadas todavía.</p>}
    {weeks.length>0&&<>
      <p className="muted">Día político {serverDay}. Consulta hasta ocho semanas
        de decisiones, posiciones, votaciones y cierres históricos.</p>
      <label className="weekly-accountability-picker">Semana política
        <select aria-label="Semana política" value={selected}
          onChange={event=>setSelected(event.target.value)}>
          {weeks.map(w=><option key={w.weekStart} value={w.weekStart}>
            {w.weekStart} · {w.status==='closed'?'cerrada':
              w.status==='live'?'actual':'cierre pendiente'}
          </option>)}
        </select>
      </label>
      {chosen&&<div className="accountability-week">
        <h3>Semana del {chosen.weekStart}</h3>
        <p className="week-note">
          {chosen.published?
            chosen.dossiers.filter(d=>d.decision).length+' de '+
              chosen.dossiers.length+' expedientes resueltos.' :
            'No se ha publicado ninguna agenda editorial para esta semana.'}
          {' '}Viernes: {chosen.friday}.
        </p>
        <ActSection week={chosen}/>
        {chosen.dossiers.length>0&&<div className="accountability-dossiers">
          <h4>Expedientes y control parlamentario</h4>
          <ul>{chosen.dossiers.map(d=><li key={d.id}>
            <strong>{d.title}</strong>
            <span>{d.category} · {d.positions} posiciones de partidos</span>
            <p>{d.decision ? 'Decisión del gobierno: '+d.decision.optionId+
              ' · coste neto '+number(d.decision.treasuryDelta)+' M€' :
              'Sin decisión ejecutiva registrada antes del viernes.'}</p>
            {d.bill&&<p>Parlamento: {d.bill.status} ·
              {' '}{d.bill.yesVotes} sí / {d.bill.noVotes} no /
              {' '}{d.bill.abstentions} abstenciones</p>}
            <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer">
              Fuente: {d.sourceTitle}
            </a>
          </li>)}</ul>
        </div>}
        <div className="accountability-parties">
          <h4>Participación de los partidos</h4>
          <ul>{chosen.parties.map(p=><li key={p.seatNo}>
            <span>{p.partyName}</span>
            <strong>{p.positions} posiciones · {p.votes} votos</strong>
          </li>)}</ul>
        </div>
      </div>}
    </>}
  </section>
}
