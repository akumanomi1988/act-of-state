import { useEffect, useRef, useState } from 'react'
import { fetchLivingConditions, livingLabels, type LivingHistory, type LivingWindow } from './lib/livingConditions'
import { number } from './lib/format'

export default function LivingConditionsPanel({ governmentId, identity }: {
  governmentId: string; identity: string
}) {
  const [days, setDays] = useState<LivingWindow>(30)
  const [dimension, setDimension] = useState<'income' | 'district'>('income')
  const [expanded, setExpanded] = useState(false)
  const [stored, setStored] = useState<{ key: string; value: LivingHistory } | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const sequence = useRef(0)
  const key = governmentId + ':' + identity + ':' + days
  const data = stored?.key === key ? stored.value : null
  useEffect(() => {
    let alive = true
    setStored(null); setError('')
    const refresh = async () => {
      const request = ++sequence.current
      try {
        const fresh = await fetchLivingConditions(governmentId, days)
        if (alive && sequence.current === request) {
          setStored({ key, value: fresh }); setError('')
        }
      } catch {
        if (alive && sequence.current === request)
          setError('No se han podido recuperar las condiciones de vida. Los datos anteriores pueden estar desactualizados.')
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 60000)
    return () => { alive = false; ++sequence.current; window.clearInterval(timer) }
  }, [governmentId, identity, days, retry, key])

  const latest = data?.latest
  const signed = (n: number) => (n > 0 ? '+' : '') + number(n)
  return <section className="living-panel" aria-label="Condiciones de vida de la población">
    <div className="population-panel-heading">
      <div><p className="eyebrow">VIDA COTIDIANA · CONSECUENCIAS SOCIALES</p>
        <h2>Cómo vive tu población</h2>
        <p className="muted">Un día real equivale a un día de juego. Empleo, inflación y servicios
          públicos influyen cada día en el bienestar y el apoyo político de los hogares sintéticos.</p>
      </div>
      <button type="button" className="text-button" aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}>{expanded ? 'Ocultar balance social' : 'Explorar balance social'}</button>
    </div>
    {error && <div role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}>Reintentar balance social</button></div>}
    {!data && !error && <p role="status">Consultando el balance social…</p>}
    {data && !latest && <p role="status">La primera medición diaria está pendiente del calendario automático.</p>}
    {latest && <>
      <p className="muted">Última acta: {latest.day} UTC · {latest.summary.households} hogares ·
        {' '}{number(latest.summary.residents)} integrantes.
        {latest.day !== data?.serverDay && ' La medición de hoy todavía está pendiente.'}</p>
      <div className="living-scores">
        {([
          ['Seguridad económica', latest.summary.economicSecurity],
          ['Acceso a servicios', latest.summary.serviceAccess],
          ['Bienestar', latest.summary.wellbeing]
        ] as const).map(([label, value]) => <div key={label}>
          <span>{label}</span><strong>{number(value)} / 100</strong>
          <meter aria-label={label} min={0} max={100} value={value} />
        </div>)}
      </div>
      <p className="living-feedback">Efecto de esta acta: aprobación
        {' '}{signed(latest.summary.approvalAfter - latest.summary.approvalBefore)} puntos · confianza
        {' '}{signed(latest.summary.trustAfter - latest.summary.trustBefore)} puntos.</p>
    </>}
    {expanded && data && <div className="living-details">
      <label>Historial de condiciones de vida
        <select value={days} onChange={e => setDays(Number(e.target.value) as LivingWindow)}>
          {([7, 30, 90] as const).map(n => <option key={n} value={n}>{n} días</option>)}
        </select>
      </label>
      <p className="muted">{data.recordedDays} / {data.expectedDays} días registrados.
        Las fechas sin medición permanecen vacías; no se reconstruye el pasado.</p>
      {latest && <>
        <div className="population-dimensions" role="group" aria-label="Desglose del bienestar">
          <button type="button" aria-pressed={dimension === 'income'} onClick={() => setDimension('income')}>Por ingresos</button>
          <button type="button" aria-pressed={dimension === 'district'} onClick={() => setDimension('district')}>Por territorio</button>
        </div>
        <div className="living-segments">{latest.segments.filter(s => s.dimension === dimension).map(s =>
          <article key={s.code}><h3>{livingLabels[s.code] ?? s.code}</h3>
            <p>{s.households} hogares · {s.residents} integrantes</p>
            <dl><div><dt>Seguridad económica</dt><dd>{number(s.economicSecurity)}</dd></div>
              <div><dt>Servicios</dt><dd>{number(s.serviceAccess)}</dd></div>
              <div><dt>Bienestar</dt><dd>{number(s.wellbeing)}</dd></div>
              <div><dt>Apoyo político</dt><dd>{number(s.support)} %</dd></div></dl>
          </article>)}</div>
        <details><summary>Factores registrados en la última acta</summary>
          <p>PIB sintético {number(latest.inputs.gdpIndex)} · desempleo
            {' '}{number(latest.inputs.unemploymentBp / 100)} % · inflación
            {' '}{number(latest.inputs.inflationBp / 100)} % · presión fiscal
            {' '}{latest.inputs.policy.tax_rate} %.</p>
          <p>Los servicios dependen de sanidad, educación, infraestructuras y seguridad.
            La edad y el entorno modifican su efecto; las rentas bajas son más sensibles a la inflación.</p>
        </details>
      </>}
      {data.history.length > 0 && <div className="living-table"><table>
        <caption>Actas diarias de bienestar (escala de 0 a 100)</caption>
        <thead><tr><th scope="col">Fecha UTC</th><th scope="col">Economía</th><th scope="col">Servicios</th><th scope="col">Bienestar</th></tr></thead>
        <tbody>{[...data.history].reverse().map(act => <tr key={act.day}>
          <th scope="row">{act.day}</th><td>{number(act.summary.economicSecurity)}</td>
          <td>{number(act.summary.serviceAccess)}</td><td>{number(act.summary.wellbeing)}</td>
        </tr>)}</tbody>
      </table></div>}
      <p className="muted">Reglas sintéticas de juego, sin encuestas ni datos de personas reales.
        El apoyo cambia con inercia, como máximo un punto por grupo y día.
        Las decisiones posteriores al acta se reflejarán en la próxima medición.
        Este balance no vuelve a cobrar gastos ni ingresos del presupuesto semanal.</p>
    </div>}
  </section>
}
