import { useEffect, useMemo, useState } from 'react'
import { FISCAL_SECTORS, fetchFiscalState, setFiscalPolicy,
  type FiscalPolicy, type FiscalSector, type FiscalState } from './lib/fiscal'
import { number } from './lib/format'
import { matchError } from './lib/multiplayer'

interface Props { governmentId: string; compact?: boolean }
type Allocation = Pick<FiscalPolicy,
  'health' | 'education' | 'infrastructure' | 'security' | 'tax_rate'>

const policyOf = (policy: FiscalPolicy): Allocation => ({
  health: policy.health, education: policy.education,
  infrastructure: policy.infrastructure, security: policy.security,
  tax_rate: policy.tax_rate
})
const signed = (n: number) => (n > 0 ? '+' : '') + number(n)

export default function FiscalPanel({ governmentId, compact = false }: Props) {
  const [state, setState] = useState<FiscalState | null>(null)
  const [from, setFrom] = useState<FiscalSector>('security')
  const [to, setTo] = useState<FiscalSector>('health')
  const [points, setPoints] = useState(5)
  const [tax, setTax] = useState(25)
  const [review, setReview] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastFetchFailed, setLastFetchFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setState(null); setError(''); setNotice(''); setReview(false)
    async function refresh() {
      try {
        const fresh = await fetchFiscalState(governmentId)
        if (!alive) return
        setState(fresh)
        setLastFetchFailed(false)
        setTax(current => current === 25 || !state ? fresh.policy.tax_rate : current)
      } catch (reason) {
        if (alive) { setError(matchError(reason)); setLastFetchFailed(true) }
      }
    }
    void refresh()
    const poll = window.setInterval(() => { void refresh() }, 30000)
    return () => { alive = false; window.clearInterval(poll) }
    // One subscription per government; ignore stale callback from prior session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governmentId])

  const next = useMemo(() => {
    if (!state) return null
    const result = policyOf(state.policy)
    if (from === to) return null
    result[from] -= points
    result[to] += points
    result.tax_rate = tax
    const valid = FISCAL_SECTORS.every(s => result[s.id] >= 10 &&
      result[s.id] <= 60 && Math.abs(result[s.id]-state.policy[s.id])<=15) &&
      Number.isInteger(points) && points > 0 && points <= 15 &&
      Number.isInteger(tax) && tax >= 10 && tax <= 45 &&
      Math.abs(tax-state.policy.tax_rate)<=5
    return valid ? result : null
  }, [state,from,to,points,tax])

  const editing = !!state?.canEdit && !!state?.canRevise && !pending
  const changed = next && state && FISCAL_SECTORS.some(s =>
    next[s.id] !== state.policy[s.id]) || (state && next?.tax_rate !== state.policy.tax_rate)

  async function save() {
    if (!next || !state || !editing || !changed || !review) return
    setPending(true);setError('');setNotice('')
    let failed: unknown
    try { await setFiscalPolicy(governmentId,next) } catch (reason) { failed = reason }
    try {
      const persisted = await fetchFiscalState(governmentId)
      setState(persisted)
      setTax(persisted.policy.tax_rate)
      setReview(false)
      if (failed) setError(matchError(failed))
      else if (FISCAL_SECTORS.every(s => persisted.policy[s.id]===next[s.id]) &&
        persisted.policy.tax_rate===next.tax_rate) {
        setNotice('Presupuesto registrado para la semana actual. El cierre del viernes lo liquidará automáticamente.')
      } else setError('No se ha podido confirmar el presupuesto. Consulta el estado antes de reintentarlo.')
    } catch (reason) {
      setError('No se ha podido verificar el presupuesto: '+matchError(reason))
    } finally { setPending(false) }
  }

  const net = state ? state.projectedRevenueM-state.projectedSpendingM : 0
  return <section className={'fiscal-panel match-panel'+(compact?' fiscal-compact':'')}
    aria-label="Presupuesto nacional e indicadores económicos">
    <p className="eyebrow">TESORO PÚBLICO · POLÍTICA FISCAL</p>
    <h3>Presupuesto del Estado</h3>
    <p className="muted">Modelo económico sintético: las cifras son reglas de juego, no previsiones
      de una economía real. Las decisiones fiscales se liquidan tras el viernes UTC.</p>
    {!state ? <p role="status">{lastFetchFailed ?
      'No se ha podido cargar el presupuesto.' : 'Cargando presupuesto nacional…'}</p> : <>
      <div className="fiscal-indicators" aria-label="Indicadores nacionales">
        <div><small>TESORERÍA</small><strong>{number(state.indicators.treasuryM)} M€</strong></div>
        <div><small>DEUDA PÚBLICA</small><strong>{number(state.indicators.debtM)} M€</strong></div>
        <div><small>PIB (ÍNDICE)</small><strong>{number(state.indicators.gdpIndex)}</strong></div>
        <div><small>DESEMPLEO SIMULADO</small><strong>{number(state.indicators.unemploymentBp/100)} %</strong></div>
        <div><small>INFLACIÓN SIMULADA</small><strong>{number(state.indicators.inflationBp/100)} %</strong></div>
      </div>
      <div className="fiscal-flow">
        <div><small>INGRESOS POR SEMANA</small><strong>{number(state.projectedRevenueM)} M€</strong></div>
        <div><small>GASTO SEMANAL</small><strong>{number(state.projectedSpendingM)} M€</strong></div>
        <div><small>SALDO PREVISTO</small><strong>{signed(net)} M€</strong></div>
      </div>
      <div className="fiscal-allocation" aria-label="Distribución del presupuesto vigente">
        {FISCAL_SECTORS.map(s => <div className="fiscal-sector" key={s.id}>
          <div><span>{s.label}</span><strong>{state.policy[s.id]} %</strong></div>
          <div className="fiscal-bar" role="progressbar" aria-label={s.label}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.policy[s.id]}>
            <span style={{ width:state.policy[s.id]+'%' }}/>
          </div>
        </div>)}
      </div>
      <p className="muted">Presión fiscal: {state.policy.tax_rate} %.
        {state.canRevise ? ' Es posible una revisión esta semana.' :
          ' El presupuesto de esta semana ya ha sido revisado.'}</p>
      {state.canEdit && state.canRevise && <div className="fiscal-edit">
        <h4>Redistribuir partidas</h4>
        <p className="muted">Traslada entre 1 y 15 puntos porcentuales entre dos áreas. La suma de todas las partidas debe seguir siendo 100 %. Solo se permite una revisión distinta por semana.</p>
        <div className="fiscal-controls">
          <label>Desde
            <select aria-label="Partida de origen" value={from} disabled={pending}
              onChange={e => { setFrom(e.target.value as FiscalSector);setReview(false) }}>
              {FISCAL_SECTORS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label>Hacia
            <select aria-label="Partida de destino" value={to} disabled={pending}
              onChange={e => { setTo(e.target.value as FiscalSector);setReview(false) }}>
              {FISCAL_SECTORS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label>Puntos
            <input aria-label="Puntos a trasladar" type="number" min="1" max="15"
              value={points} disabled={pending}
              onChange={e => { setPoints(Number(e.target.value));setReview(false) }}/>
          </label>
          <label>Presión fiscal (%)
            <input aria-label="Nuevo tipo fiscal" type="number" min="10" max="45"
              value={tax} disabled={pending}
              onChange={e => {setTax(Number(e.target.value));setReview(false)}}/>
          </label>
        </div>
        {!next && <p role="status" className="muted">Selecciona dos partidas distintas y una distribución dentro de los límites legales.</p>}
        {!review ? <button type="button" disabled={!editing || !next || !changed}
          onClick={() => setReview(true)}>Revisar nueva distribución</button> :
          <div className="fiscal-confirm">
            <p>Confirmar: {FISCAL_SECTORS.map(s => s.label+' '+next?.[s.id]+'%').join(' · ')}
              {' '}· fiscalidad {next?.tax_rate}%.</p>
            <div className="review-actions">
              <button type="button" disabled={pending} onClick={() => void save()}>
                Aprobar presupuesto semanal</button>
              <button type="button" className="text-button" disabled={pending}
                onClick={() => setReview(false)}>Cancelar</button>
            </div>
          </div>}
      </div>}
      {state.canEdit===false && <p role="status" className="muted">
        Consulta parlamentaria: solo el gobierno puede redistribuir el presupuesto.
      </p>}
      <div className="fiscal-history">
        <h4>Cierres fiscales auditables</h4>
        {state.history.length===0 ? <p className="muted">La primera liquidación aparecerá el sábado posterior al primer viernes completo.</p> :
          <ul>{state.history.slice(0,6).map(act => <li key={act.week_start}>
            <span>Semana del {act.week_start}</span>
            <strong>{signed(act.balance_m_eur)} M€</strong>
            <small>Tesorería {number(act.treasury_after_m_eur)} M€ ·
              deuda {number(act.debt_after_m_eur)} M€</small>
          </li>)}</ul>}
      </div>
    </>}
    {notice && <p className="editorial-success" role="status">{notice}</p>}
    {error && <p className="editorial-alert" role="alert">{error}</p>}
  </section>
}
