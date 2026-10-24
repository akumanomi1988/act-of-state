import { useMemo, useState } from 'react'
import { number } from './lib/format'
import {
  analyzeDecisionHistory, type HistoryMetric, type HistoryPeriod
} from './lib/decisionAnalytics'
import type { DecisionEvent } from './lib/types'

interface Props {
  events: readonly DecisionEvent[]
  gameDay: string
  countryName: string
}

const metricLabels: Record<HistoryMetric, string> = {
  treasury: 'Tesorería', approval: 'Aprobación', trust: 'Confianza'
}
const periodLabels: Record<HistoryPeriod, string> = {
  all: 'Todo', '7d': '7 días', '30d': '30 días'
}

function signed(value: number, suffix = ''): string {
  return (value > 0 ? '+' : '') + number(value) + suffix
}

function deltaClass(value: number): string {
  return value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'
}

export default function DecisionAnalyticsPanel({ events, gameDay, countryName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [period, setPeriod] = useState<HistoryPeriod>('all')
  const [metric, setMetric] = useState<HistoryMetric>('approval')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const lifetime = useMemo(
    () => analyzeDecisionHistory(events, gameDay, 'all'),
    [events, gameDay]
  )
  const analysis = useMemo(
    () => analyzeDecisionHistory(events, gameDay, period),
    [events, gameDay, period]
  )
  const displayed = analysis.rows.slice(-50).reverse()
  const selected = analysis.rows.find(row => row.event.id === selectedId)
    ?? analysis.rows[analysis.rows.length - 1]
  const scale = Math.max(1, ...displayed.map(row => Math.abs(row[metric])))

  return <section className="national-history" aria-label="Archivo estratégico nacional">
    <div className="national-history-heading">
      <div>
        <p className="eyebrow">ARCHIVO ESTRATÉGICO · ACTOS DE GOBIERNO</p>
        <h2>Cómo han cambiado tus decisiones el rumbo de {countryName}</h2>
        <p className="muted">Análisis de resultados realmente registrados, no previsiones.
          Las liquidaciones fiscales automáticas y las elecciones se contabilizan por separado.</p>
      </div>
      <button type="button" className="text-button"
        aria-expanded={expanded} aria-controls="national-history-details"
        onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Cerrar análisis' : 'Explorar impacto'}
      </button>
    </div>
    <div className="national-history-summary" aria-label="Impacto acumulado de decisiones">
      <div><span>DECISIONES FIRMADAS</span><strong>{lifetime.rows.length}</strong></div>
      <div><span>IMPACTO FISCAL DIRECTO</span>
        <strong className={deltaClass(lifetime.totals.treasury)}>
          {signed(lifetime.totals.treasury, ' M€')}
        </strong></div>
      <div><span>CAMBIO DE APROBACIÓN</span>
        <strong className={deltaClass(lifetime.totals.approval)}>
          {signed(lifetime.totals.approval, ' pp')}
        </strong></div>
      <div><span>CAMBIO DE CONFIANZA</span>
        <strong className={deltaClass(lifetime.totals.trust)}>
          {signed(lifetime.totals.trust, ' pp')}
        </strong></div>
    </div>
    {expanded && <div id="national-history-details" className="national-history-details">
      <div className="national-history-controls">
        <fieldset>
          <legend>Periodo</legend>
          {(Object.keys(periodLabels) as HistoryPeriod[]).map(value =>
            <label key={value}><input type="radio" name="history-period" value={value}
              checked={period === value} onChange={() => setPeriod(value)} />
              {periodLabels[value]}</label>
          )}
        </fieldset>
        <fieldset>
          <legend>Indicador</legend>
          {(Object.keys(metricLabels) as HistoryMetric[]).map(value =>
            <label key={value}><input type="radio" name="history-metric" value={value}
              checked={metric === value} onChange={() => setMetric(value)} />
              {metricLabels[value]}</label>
          )}
        </fieldset>
      </div>
      {analysis.rows.length === 0 ? <p className="muted" role="status">
        No hay decisiones firmadas en este periodo.</p> : <>
        <div className="national-history-grid">
          <section className="national-history-chart" aria-label="Cronología de impactos">
            <h3>Impacto por decisión · {metricLabels[metric].toLowerCase()}</h3>
            {analysis.rows.length > 50 && <p className="muted">
              Se muestran las últimas 50 de {analysis.rows.length} decisiones.
              Los totales del periodo incluyen todas.</p>}
            <ol>
              {displayed.map(row => <li key={row.event.id}>
                <button type="button" className={'national-history-entry ' +
                  (selected?.event.id === row.event.id ? 'selected' : '')}
                  aria-pressed={selected?.event.id === row.event.id}
                  onClick={() => setSelectedId(row.event.id)}>
                  <span className="national-history-entry-title">
                    <strong>{row.event.option_title_snapshot}</strong>
                    <small>{row.event.decided_on}</small>
                  </span>
                  <span className="national-history-track" aria-hidden="true">
                    <span className={deltaClass(row[metric])}
                      style={{ width: Math.abs(row[metric]) / scale * 100 + '%' }} />
                  </span>
                  <span className={'national-history-value ' + deltaClass(row[metric])}>
                    {signed(row[metric], metric === 'treasury' ? ' M€' : ' pp')}
                  </span>
                </button>
              </li>)}
            </ol>
          </section>
          {selected && <section className="national-history-inspector"
            aria-label="Detalle de la decisión seleccionada">
            <p className="eyebrow">ACTO REGISTRADO · {selected.event.decided_on}</p>
            <h3>{selected.event.dossier_title_snapshot}</h3>
            <p>{selected.event.option_title_snapshot}</p>
            <dl className="national-history-deltas">
              <div><dt>Tesorería</dt><dd>{number(selected.event.state_before.treasury_m_eur)}
                {' → '}{number(selected.event.state_after.treasury_m_eur)} M€
                <strong className={deltaClass(selected.treasury)}>
                  {signed(selected.treasury, ' M€')}</strong></dd></div>
              <div><dt>Aprobación</dt><dd>{selected.event.state_before.approval}
                {' → '}{selected.event.state_after.approval}%
                <strong className={deltaClass(selected.approval)}>
                  {signed(selected.approval, ' pp')}</strong></dd></div>
              <div><dt>Confianza</dt><dd>{selected.event.state_before.trust}
                {' → '}{selected.event.state_after.trust}%
                <strong className={deltaClass(selected.trust)}>
                  {signed(selected.trust, ' pp')}</strong></dd></div>
            </dl>
            <h4>Respuesta de los grupos sociales</h4>
            {selected.event.cohort_effects.length === 0
              ? <p className="muted">Sin efectos de población registrados.</p>
              : <ul className="national-history-cohorts">
                {selected.event.cohort_effects.map(effect => <li key={effect.code}>
                  <strong>{effect.label}</strong>
                  <span>Apoyo {effect.support_before} → {effect.support_after}%</span>
                  <span>Confianza {effect.trust_before} → {effect.trust_after}%</span>
                </li>)}
              </ul>}
            <small className="muted">Modelo persistido: {selected.event.engine_version}.</small>
          </section>}
        </div>
        {analysis.cohorts.length > 0 && <section className="national-history-social"
          aria-label="Balance social del periodo">
          <h3>Balance social acumulado</h3>
          <p className="muted">Suma de cambios atribuibles a las decisiones del periodo;
            no representa el apoyo actual ni una predicción electoral.</p>
          <div className="national-history-social-grid">
            {analysis.cohorts.map(cohort => <div key={cohort.code}>
              <strong>{cohort.label}</strong>
              <small>{cohort.populationWeight}% de población · {cohort.decisions} decisiones</small>
              <span>Apoyo <b className={deltaClass(cohort.support)}>
                {signed(cohort.support, ' pp')}</b></span>
              <span>Confianza <b className={deltaClass(cohort.trust)}>
                {signed(cohort.trust, ' pp')}</b></span>
            </div>)}
          </div>
        </section>}
      </>}
    </div>}
  </section>
}
