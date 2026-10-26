import { useEffect, useState } from 'react'
import {
  fetchCampaignState, launchPartyCampaign,
  type CampaignState, type CampaignStrategy
} from './lib/campaign'
import { matchError } from './lib/multiplayer'
import { fetchPartyFinances, type PartyFinanceState } from './lib/partyFinances'

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
  const [finance, setFinance] = useState<PartyFinanceState | null>(null)
  const [cohort, setCohort] = useState('')
  const [strategy, setStrategy] = useState<CampaignStrategy>('dialogue')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let alive = true
    setState(null); setFinance(null); setCohort(''); setError(''); setNotice('')
    async function refresh() {
      try {
        const [next, ledger] = await Promise.all([
          fetchCampaignState(matchId), fetchPartyFinances(matchId)
        ])
        if (alive) { setState(next); setFinance(ledger); setError('') }
      } catch (reason) {
        if (alive) setError(matchError(reason))
      }
    }
    void refresh()
    const handle = window.setInterval(() => { void refresh() }, 15000)
    return () => { alive = false; window.clearInterval(handle) }
  }, [matchId, userId])

  const selected = cohort || state?.cohorts[0]?.code || ''

  const cost = finance?.costs[strategy] ?? 0
  const affordable = !!finance && finance.active && finance.availableCredits >= cost

  async function execute() {
    if (!state?.available || busy || !selected || !active || !affordable) return
    setBusy(true); setError(''); setNotice('')
    let issuedId: string | null = null
    let issuedError: unknown = null
    try {
      const act = await launchPartyCampaign(matchId, selected, strategy)
      issuedId = act.id
    } catch (reason) { issuedError = reason }
    try {
      // Both immutable receipts and campaign history must confirm the same act.
      const [fresh, ledger] = await Promise.all([
        fetchCampaignState(matchId), fetchPartyFinances(matchId)
      ])
      setState(fresh); setFinance(ledger)
      const matched = fresh.recentActs.find(act => act.id === issuedId
        && act.user_id === userId && act.strategy === strategy
        && act.cohort_code === selected)
      const receipt = ledger.recentSpending.find(item => item.campaignEventId === issuedId)
      if (issuedId && matched && receipt && receipt.costCredits === cost) {
        setNotice('Campaña registrada. El gasto y el apoyo constan en el historial oficial.')
        onCampaignRecorded()
      } else setError(issuedError ? matchError(issuedError)
        : 'La campaña todavía no está confirmada en los registros. Comprueba el historial.')
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
      {finance && <section className="campaign-finances" aria-label="Tesorería electoral del partido">
        <h3>Financiación pública ficticia</h3>
        <p className="muted">Todas las candidaturas reciben 12 créditos al comenzar
          y 4 créditos adicionales cada lunes UTC. No hay compras ni donaciones.</p>
        <div className="campaign-finance-summary">
          <span>Asignados <strong>{finance.earnedCredits}</strong></span>
          <span>Invertidos <strong>{finance.spentCredits}</strong></span>
          <span>Disponibles <strong>{finance.availableCredits}</strong></span>
        </div>
        {finance.recentSpending.length > 0 && <details>
          <summary>Libro de gastos ({finance.recentSpending.length})</summary>
          <ol>{finance.recentSpending.map(item => <li key={item.id}>
            {item.weekStart} · {strategyNames[item.strategy]} · {item.cohortCode}
            {' '}· −{item.costCredits} créditos
          </li>)}</ol>
        </details>}
      </section>}
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
        <p className="muted">Coste de esta estrategia: {cost} créditos.</p>
        {!affordable && finance && <p role="status" className="campaign-insufficient">
          Créditos insuficientes. Elige una estrategia más económica o espera
          la próxima asignación semanal.
        </p>}
        <button disabled={busy || !selected || !affordable} onClick={() => void execute()}>
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
