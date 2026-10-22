import type { DecisionEvent } from '../lib/types'
import { change, number } from '../lib/format'

interface Props {
  event: DecisionEvent
  optionTitle: string
}

export default function Outcome({ event, optionTitle }: Props) {
  return (
    <section className="outcome" aria-label="Resultado de la decisión" data-testid="persisted-outcome">
      <div className="eyebrow">DECISIÓN REGISTRADA · {event.decided_on}</div>
      <h3>{optionTitle}</h3>
      <p className="muted">Resultado persistido · Motor {event.engine_version}</p>
      <div className="impact-grid">
        <div><span>Tesorería</span><strong>{number(event.state_after.treasury_m_eur)} M€</strong>
          <small>{change(event.state_before.treasury_m_eur, event.state_after.treasury_m_eur)} M€</small></div>
        <div><span>Aprobación</span><strong>{event.state_after.approval}%</strong>
          <small>{change(event.state_before.approval, event.state_after.approval)} puntos</small></div>
        <div><span>Confianza</span><strong>{event.state_after.trust}%</strong>
          <small>{change(event.state_before.trust, event.state_after.trust)} puntos</small></div>
      </div>
      <h4>Respuesta de la población</h4>
      <div className="cohort-list">
        {event.cohort_effects.map(cohort => (
          <div className="cohort" key={cohort.code}>
            <div><strong>{cohort.label}</strong><span>{cohort.population_weight}% de población representada</span></div>
            <div>Apoyo: {cohort.support_before}% → <strong>{cohort.support_after}%</strong></div>
            <div>Confianza: {cohort.trust_before}% → <strong>{cohort.trust_after}%</strong></div>
          </div>
        ))}
      </div>
    </section>
  )
}
