import { useEffect, useState } from 'react'
import {
  fetchCampaignState, launchPartyCampaign,
  type CampaignState, type CampaignStrategy
} from './lib/campaign'
import { matchError } from './lib/multiplayer'

const strategyNames: Record<CampaignStrategy, string> = {
  dialogue: 'Diálogo vecinal',
  field_visit: 'Visita territorial',
  policy_forum: 'Foro de propuestas'
}

interface Props {
  matchId: string
  userId: string
  active: boolean
  onCampaignRecorded: () => void
}

export default function CampaignPanel({ matchId, userId, active, onCampaignRecorded }: Props) {
  const [state, setState] = useState<CampaignState | null>(null)
  const [cohort, setCohort] = useState('')
  const [strategy, setStrategy] = useState<CampaignStrategy>('dialogue')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let alive = true
    setState(null); setCohort(''); setError(''); setNotice('')
    async function refresh() {
      try {
        const next = await fetchCampaignState(matchId)
        if (alive) { setState(next); setError('') }
      } catch (reason) {
        if (alive) setError(matchError(reason))
      }
    }
    void refresh()
    const handle = window.setInterval(() => { void refresh() }, 15000)
    return () => { alive = false; window.clearInterval(handle) }
  }, [matchId, userId])

  const selected = cohort || state?.cohorts[0]?.code || ''

  async function execute() {
    if (!state?.available || busy || !selected || !active) return
    setBusy(true); setError(''); setNotice('')
    let issuedError: unknown = null
    try { await launchPartyCampaign(matchId, selected, strategy) }
    catch (reason) { issuedError = reason }
    try {
      // Never announce campaign effects until the authoritative read confirms them.
      const fresh = await fetchCampaignState(matchId)
      setState(fresh)
      if (issuedError) setError(matchError(issuedError))
      else {
        setNotice('Campaña registrada. La proyección electoral incorpora el nuevo apoyo.')
        onCampaignRecorded()
      }
    } catch (reason) {
      setError(matchError(issuedError ?? reason))
    } finally { setBusy(false) }
  }

  return <section className="campaign-panel" aria-label="Campaña electoral">
    <div className="campaign-panel-heading">
      <div>
        <p className="eyebrow">PARTIDOS · OPINIÓN PÚBLICA</p>
        <h2>Campaña y persuasión electoral</h2>
        <p className="muted">Cada partido puede realizar una intervención semanal.
          El servidor calcula un impacto limitado según el programa y el grupo social.
          El apoyo se desgasta dos puntos cada siete días sin una nueva intervención en ese grupo.</p>
      </div>
      <p className="campaign-week">Semana {state?.weekStart ?? '—'}</p>
    </div>
    {!state && !error && <p role="status">Recuperando campaña…</p>}
    {state && <>
      <div className="campaign-cohorts" aria-label="Grupos representativos">
        {state.cohorts.map(group => <div className="campaign-cohort" key={group.code}>
          <strong>{group.label}</strong>
          <span>{group.weight}% de población · preferencia {group.idealPolicy}/100</span>
          <span>Influencia efectiva actual: <strong>{group.myInfluence}/20</strong></span>
          {group.nextDecayOn && <small>Próximo desgaste: {group.nextDecayOn} (UTC)</small>}
        </div>)}
      </div>
      {active && state.available ? <div className="campaign-actions">
        <label>Grupo social objetivo
          <select value={selected} disabled={busy} onChange={e => setCohort(e.target.value)}>
            {state.cohorts.map(g => <option value={g.code} key={g.code}>{g.label}</option>)}
          </select>
        </label>
        <label>Acción política
          <select value={strategy} disabled={busy}
            onChange={e => setStrategy(e.target.value as CampaignStrategy)}>
            {Object.entries(strategyNames).map(([code, name]) =>
              <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <button disabled={busy || !selected} onClick={() => void execute()}>
          {busy ? 'Registrando…' : 'Realizar campaña semanal'}
        </button>
      </div> : <p role="status" className="muted">
        {!active ? 'La campaña se abrirá cuando comience la partida.'
          : state.usedThisWeek ? 'Tu partido ya ha realizado su campaña esta semana.'
          : 'La campaña está cerrada durante el periodo electoral de reflexión.'}
      </p>}
      {state.recentActs.length > 0 && <details className="campaign-history">
        <summary>Registro público de campañas ({state.recentActs.length})</summary>
        <ol>{state.recentActs.map(act => <li key={act.id}>
          <strong>{act.party_name}</strong> · {act.week_start} · {act.cohort_code} ·
          {' '}{strategyNames[act.strategy] ?? act.strategy} ·
          {' '}+{act.influence_delta} puntos ganados (registro al actuar: {act.influence_after}/20)
        </li>)}</ol>
      </details>}
    </>}
    {state && <p className="muted" role="note">Las campañas pasadas conservan su resultado original. La influencia que cuenta para encuestas y urnas es el valor efectivo actual, no la suma histórica.</p>}
    {notice && <p role="status" className="campaign-notice">{notice}</p>}
    {error && <p role="alert" className="campaign-error">{error}</p>}
  </section>
}
