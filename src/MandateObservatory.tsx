import { useEffect, useMemo, useState } from 'react'
import { fetchFiscalState, type FiscalState } from './lib/fiscal'
import { fetchLivingConditions, type LivingHistory } from './lib/livingConditions'
import { fetchOpinionHistory, type OpinionHistory } from './lib/opinionPolls'
import { fetchElectionState, type ElectionState } from './lib/elections'
import {
  buildMandateReport, fiscalStressScenarios, type MandateWindow
} from './lib/mandateObservatory'
import { number } from './lib/format'
import './MandateObservatory.css'

interface Sources {
  key: string
  fiscal: FiscalState | null
  living: LivingHistory | null
  opinion: OpinionHistory | null
  election: ElectionState | null
  errors: string[]
}
interface Props {
  governmentId: string
  identity: string
  matchId?: string
}
const display = (value: number | null, suffix = '') =>
  value === null ? 'Sin dato' : number(value) + suffix
const delta = (value: number | null, suffix = '') =>
  value === null ? 'Sin comparativa' : (value > 0 ? '+' : '') + number(value) + suffix

/**
 * The backend retains all authority: this component only reads already
 * authenticated economic, welfare, election and polling history.
 * Account switches cannot render a previous user's resolved RPC response.
 */
export default function MandateObservatory({ governmentId, identity, matchId }: Props) {
  const [days, setDays] = useState<MandateWindow>(30)
  const [expanded, setExpanded] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [stored, setStored] = useState<Sources | null>(null)
  const [busy, setBusy] = useState(false)
  const key = governmentId + ':' + identity + ':' + (matchId ?? 'solo') + ':' + days
  useEffect(() => {
    if (!expanded) return
    let active = true
    let latestRequest = 0
    setStored(null); setBusy(true)
    async function load() {
      // Interval reads can overlap slow provider responses. Only the newest
      // request may update the screen, even if an older request ends last.
      const requestId = ++latestRequest
      const [fiscal, living, opinion, election] = await Promise.allSettled([
        fetchFiscalState(governmentId),
        fetchLivingConditions(governmentId, days),
        matchId ? fetchOpinionHistory(matchId, days) : Promise.resolve(null),
        matchId ? fetchElectionState(matchId) : Promise.resolve(null)
      ])
      if (!active || requestId !== latestRequest) return
      const errors: string[] = []
      if (fiscal.status === 'rejected') errors.push('No se pudieron recuperar las actas fiscales.')
      if (living.status === 'rejected') errors.push('No se pudieron recuperar las actas de bienestar.')
      if (opinion.status === 'rejected') errors.push('No se pudieron recuperar las mediciones de voto.')
      if (election.status === 'rejected') errors.push('No se pudo recuperar el historial electoral.')
      setStored({
        key,
        fiscal:fiscal.status === 'fulfilled' ? fiscal.value : null,
        living:living.status === 'fulfilled' ? living.value : null,
        opinion:opinion.status === 'fulfilled' ? opinion.value : null,
        election:election.status === 'fulfilled' ? election.value : null,
        errors
      })
      setBusy(false)
    }
    void load()
    const interval = window.setInterval(() => void load(), 60000)
    return () => { active = false; latestRequest++; window.clearInterval(interval) }
  }, [governmentId, identity, matchId, days, refresh, expanded, key])

  const data = stored?.key === key ? stored : null
  const outcome = useMemo(() => {
    if (!data) return { report:null, error:'' }
    try {
      return { report:buildMandateReport({
        ...data, days, userId:matchId ? identity : undefined
      }), error:'' }
    } catch {
      return { report:null, error:'Los registros proceden de días distintos. Actualiza para reconciliar las fuentes.' }
    }
  }, [data, days, matchId, identity])
  const report = outcome.report
  const stress = data?.fiscal ? fiscalStressScenarios(data.fiscal) : []
  const society = report?.society
  const fiscal = report?.fiscal
  const electoral = report?.election

  return <section className="mandate-observatory" aria-label="Observatorio estratégico del mandato">
    <header className="mandate-header">
      <div>
        <p className="eyebrow">ARCHIVO NACIONAL · EVIDENCIA DE LA SIMULACIÓN</p>
        <h2>Balance estratégico del mandato</h2>
        <p className="muted">Contrasta decisiones de gobierno con actas fiscales, bienestar
          y {matchId ? 'apoyo electoral registrado' : 'evolución social'}.
          No se fabrican días transcurridos ni se reescriben resultados.</p>
      </div>
      <button type="button" className="text-button" aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Cerrar observatorio' : 'Analizar mandato'}
      </button>
    </header>
    {expanded && <div className="mandate-content">
      <div className="mandate-controls">
        <fieldset>
          <legend>Periodo de observación</legend>
          {([7, 30, 90] as const).map(value => <label key={value}>
            <input type="radio" name={'mandate-window-'+governmentId}
              checked={days === value} onChange={() => setDays(value)} />
            {value} días
          </label>)}
        </fieldset>
        <button type="button" onClick={() => setRefresh(value => value + 1)}
          disabled={busy}>Actualizar actas</button>
      </div>
      {busy && <p role="status">Recuperando actas oficiales…</p>}
      {data?.errors.length ? <div role="alert" className="mandate-errors">
        {data.errors.map(text => <p key={text}>{text}</p>)}
        <p>Los apartados sin actas no se muestran como resultados comprobados.</p>
      </div> : null}
      {outcome.error && <p role="alert">{outcome.error}</p>}
      {report && <>
        <p className="muted">Corte del servidor: {report.day} UTC.
          Periodo: {report.fromDay} — {report.day}. Todas las magnitudes son sintéticas.</p>
        <div className="mandate-metrics" aria-label="Resultados contrastados del mandato">
          <article>
            <span>SALDO SEMANAL DEL PRESUPUESTO ACTUAL</span>
            <strong>{fiscal ? delta(fiscal.balance, ' M€') : 'Sin dato'}</strong>
            <small>Hipótesis presupuestaria, no liquidación histórica.</small>
          </article>
          <article>
            <span>DEUDA PÚBLICA ACTUAL</span>
            <strong>{fiscal ? display(fiscal.debt, ' M€') : 'Sin dato'}</strong>
            <small>Estado económico autorizado por el servidor.</small>
          </article>
          <article>
            <span>BIENESTAR REGISTRADO</span>
            <strong>{society ? display(society.latest, ' / 100') : 'Sin dato'}</strong>
            <small>Variación en el periodo: {society ? delta(society.change, ' puntos') : '—'}.</small>
          </article>
          {matchId && <article>
            <span>ESTIMACIÓN DE VOTO DE TU PARTIDO</span>
            <strong>{electoral ? display(electoral.latest, ' %') : 'Sin dato'}</strong>
            <small>{electoral ? delta(electoral.delta, ' puntos') : '—'}.
              No equivale a una elección certificada.</small>
          </article>}
        </div>
        {report.findings.length > 0 ? <div className="mandate-findings">
          <h3>Aspectos que requieren atención</h3>
          <ul>{report.findings.map(finding => <li key={finding}>{finding}</li>)}</ul>
        </div> : <p role="status">No se han identificado alertas según los umbrales de esta lectura.</p>}
        <div className="mandate-columns">
          <section aria-label="Resistencia presupuestaria">
            <h3>Resistencia presupuestaria</h3>
            <p>Actas fiscales en el periodo: <strong>{fiscal?.settledWeeks ?? 0}</strong>.
              {' '}Semanas con déficit observado: <strong>{fiscal?.deficitWeeks ?? 0}</strong>.
              {' '}Deuda emitida en actas: <strong>{fiscal ? number(fiscal.debtIssued)+' M€' : 'Sin dato'}</strong>.</p>
            <p className="muted">El servidor devuelve hasta doce cierres fiscales recientes;
              la ausencia de un cierre anterior no equivale a saldo cero.</p>
            {data?.fiscal && <div className="mandate-table"><table>
              <caption>Escenarios aritméticos, no previstos ni ejecutados</caption>
              <thead><tr><th scope="col">Supuesto</th><th scope="col">Saldo semanal</th>
                <th scope="col">Colchón de tesorería</th></tr></thead>
              <tbody>{stress.map(item => <tr key={item.label}>
                <th scope="row">{item.label}</th>
                <td>{delta(item.weeklyBalance, ' M€')}</td>
                <td>{item.bufferWeeks === null ? 'Sin déficit' :
                  item.bufferWeeks + ' semanas a saldo constante'}</td>
              </tr>)}</tbody></table></div>}
            <p className="muted">El cálculo de colchón ignora nuevas decisiones, ajustes,
              deuda y otros flujos. No anticipa resultados económicos reales.</p>
          </section>
          <section aria-label="Continuidad de las mediciones sociales y electorales">
            <h3>Continuidad y estado social</h3>
            <p>Actas sociales: <strong>{society ? society.recorded+' / '+society.expected : 'Sin dato'}</strong>.
              {' '}Días sin medición: <strong>{society?.missing ?? '—'}</strong>.
              {' '}Racha más larga: <strong>{society?.consecutiveDays ?? 0} días</strong>.</p>
            <p>Peor bienestar observado: <strong>{society ?
              display(society.minimum, ' / 100') : 'Sin dato'}</strong>
              {society?.minimumDay ? ' · '+society.minimumDay : ''}.</p>
            {matchId && <p>Capturas de voto: <strong>{electoral ?
              electoral.recorded+' / '+electoral.expected : 'Sin dato'}</strong>.
              {' '}Elecciones certificadas en el periodo: <strong>{electoral?.certified ?? '—'}</strong>.
              {' '}Escaños estimados actuales: <strong>{electoral?.seats ?? '—'}</strong>.</p>}
          </section>
        </div>
        {society?.records.length ? <details className="mandate-history">
          <summary>Consultar actas sociales del periodo ({society.records.length})</summary>
          <div className="mandate-table"><table>
            <caption>Serie histórica sin interpolación</caption>
            <thead><tr><th scope="col">Día UTC</th><th scope="col">Bienestar</th>
              <th scope="col">Seguridad económica</th><th scope="col">Servicios</th></tr></thead>
            <tbody>{[...society.records].reverse().map(record => <tr key={record.day}>
              <th scope="row">{record.day}</th><td>{number(record.summary.wellbeing)}</td>
              <td>{number(record.summary.economicSecurity)}</td>
              <td>{number(record.summary.serviceAccess)}</td>
            </tr>)}</tbody>
          </table></div>
        </details> : <p role="status">No existen actas sociales observadas para este periodo.</p>}
      </>}
    </div>}
  </section>
}
