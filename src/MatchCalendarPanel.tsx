import { useEffect, useState } from 'react'
import { number } from './lib/format'
import { fetchMatchCalendar, matchError, type MatchCalendar } from './lib/multiplayer'

export default function MatchCalendarPanel({ matchId }: { matchId: string }) {
  const [calendar, setCalendar] = useState<MatchCalendar | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    let revision = 0
    setCalendar(null)
    setError('')
    const refresh = async () => {
      const request = ++revision
      try {
        const next = await fetchMatchCalendar(matchId)
        if (!alive || request !== revision) return
        setCalendar(next)
        setError('')
      } catch (reason) {
        if (alive && request === revision) setError(matchError(reason))
      }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 60000)
    return () => { alive = false; revision++; window.clearInterval(interval) }
  }, [matchId])

  return <section className="weekly-card" aria-label="Calendario político de la partida">
    <div className="eyebrow">CICLO POLÍTICO · RELOJ DEL SERVIDOR</div>
    <h2>Calendario político</h2>
    {!calendar ? <p role="status">Consultando el calendario institucional…</p> : <>
      <p className="muted">Día de juego {calendar.gameDay}. Cada día real equivale a un día político (UTC).</p>
      <div className="week-dates">
        <div><span>LUNES · EXPEDIENTES</span><strong>{calendar.monday}</strong></div>
        <div><span>VIERNES · BALANCE</span><strong>{calendar.friday}</strong></div>
      </div>
      <p className="week-note">{calendar.weeklyPublished
        ? calendar.weeklyResolved + ' de ' + calendar.weeklyTotal + ' expedientes resueltos esta semana.'
        : 'La agenda de diez expedientes aún no está aprobada para esta semana.'}</p>
      <p className="week-note">{calendar.fridayReached
        ? 'Viernes alcanzado: el cierre definitivo se registra el sábado UTC.'
        : 'El viernes se cierra el balance político de la semana.'}</p>
      {calendar.latestFriday && <div className="week-balance">
        <span>ÚLTIMO VIERNES CERRADO · {calendar.latestFriday.week_start}</span>
        <strong>{calendar.latestFriday.decisions_resolved} decisiones ·
          {calendar.latestFriday.treasury_delta_m_eur >= 0 ? ' +' : ' '}
          {number(calendar.latestFriday.treasury_delta_m_eur)} M€</strong>
        <small>Tesoro {number(calendar.latestFriday.treasury_at_friday_m_eur)} M€ ·
          aprobación {calendar.latestFriday.approval_at_friday}% ·
          confianza {calendar.latestFriday.trust_at_friday}%</small>
      </div>}
    </>}
    {error && <p role="alert" className="editorial-alert">{error}</p>}
  </section>
}
