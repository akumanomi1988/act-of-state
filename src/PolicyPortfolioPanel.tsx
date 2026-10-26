import { useMemo, useState } from 'react'
import type { DecisionEvent, Dossier, DossierOption } from './lib/types'
import { CHAPTERS } from './lib/nationalProgramme'
import {
  buildPolicyPortfolio, portfolioKey, type PortfolioChapter, type PortfolioPicks
} from './lib/policyPortfolio'
import { number } from './lib/format'
import './PolicyPortfolioPanel.css'

interface Props {
  dossiers: readonly Dossier[]
  options: readonly DossierOption[]
  events: readonly DecisionEvent[]
  gameDay: string
  treasury: number
  onSelect: (dossier: Dossier) => void
  mode: 'solo' | 'parliament'
}

export default function PolicyPortfolioPanel({
  dossiers, options, events, gameDay, treasury, onSelect, mode
}: Props) {
  const [picks, setPicks] = useState<PortfolioPicks>({})
  const [chapter, setChapter] = useState<PortfolioChapter>('all')
  const [expanded, setExpanded] = useState(false)
  const portfolio = useMemo(
    () => buildPolicyPortfolio(dossiers, options, events, gameDay, picks, treasury),
    [dossiers, options, events, gameDay, picks, treasury]
  )
  const visible = portfolio.cases.filter(item => chapter === 'all' || chapter === item.chapter)
  const selectedCases = portfolio.cases.filter(item => item.selected)
  const isParliament = mode === 'parliament'

  function choose(key: string, optionId: string) {
    setPicks(current => ({ ...current, [key]: optionId }))
  }
  function clearPlan() { setPicks({}) }

  return <section className="policy-portfolio" aria-label="Planificador de cartera legislativa">
    <div className="policy-portfolio-top">
      <div>
        <p className="eyebrow">SIMULACIÓN ESTRATÉGICA · SIN FIRMA</p>
        <h2>Planifica tu próxima agenda</h2>
        <p className="muted">Compara decisiones pendientes de los seis capítulos antes de actuar.</p>
      </div>
      <button type="button" className="text-button" aria-expanded={expanded}
        aria-controls="policy-portfolio-body" onClick={() => setExpanded(value => !value)}>
        {expanded ? 'Cerrar planificación' : 'Abrir planificación'}
      </button>
    </div>
    <div className="policy-portfolio-summary" aria-label="Estado del programa">
      <span><strong>{portfolio.signed}/{portfolio.total}</strong> actos firmados</span>
      <span><strong>{portfolio.available}</strong> expedientes disponibles</span>
      <span><strong>{portfolio.selected}</strong> medidas en el borrador</span>
    </div>
    {expanded && <div id="policy-portfolio-body">
      <p className="policy-portfolio-disclaimer">
        {isParliament
          ? 'Borrador temporal: no equivale a postura oficial, propuesta, voto ni ley. Cada medida exige el procedimiento parlamentario.'
          : 'Borrador temporal en esta pantalla: no ejecuta decisiones. Cada medida requiere su firma individual.'}
        {' '}Solo se suman los parámetros fiscales directos publicados; no se calculan efectos futuros, aprobación ni confianza.
      </p>
      <div className="policy-portfolio-fiscal" aria-live="polite">
        <div><span>Tesorería registrada</span><strong>{number(treasury)} M€</strong></div>
        <div><span>Variación fiscal hipotética</span><strong>
          {portfolio.selectedFiscalDelta > 0 ? '+' : ''}{number(portfolio.selectedFiscalDelta)} M€
        </strong></div>
        <div><span>Saldo aritmético orientativo</span><strong>{number(portfolio.projectedTreasury)} M€</strong></div>
      </div>
      {portfolio.hasFiscalDeficit && <p role="alert" className="policy-portfolio-risk">
        Atención: el borrador supera la tesorería registrada. El motor fiscal y los efectos posteriores
        solo pueden confirmarse tras cada decisión autorizada.
      </p>}
      {portfolio.selected > 0 && <div className="policy-portfolio-draft" aria-label="Medidas seleccionadas">
        <strong>Borrador ({portfolio.selected})</strong>
        <ol>{selectedCases.map(item => <li key={item.key}>
          {item.dossier.title}: {item.selected?.title}
          <button type="button" className="text-button"
            onClick={() => choose(item.key, '')}
            aria-label={'Quitar ' + item.dossier.title}>Quitar</button>
        </li>)}</ol>
        <button type="button" className="text-button" onClick={clearPlan}>Vaciar borrador</button>
      </div>}
      <div className="policy-portfolio-filters" role="group" aria-label="Filtrar capítulos">
        <button type="button" aria-pressed={chapter === 'all'}
          onClick={() => setChapter('all')}>Todos ({portfolio.total})</button>
        {portfolio.chapters.map(item => <button type="button" key={item.id}
          aria-pressed={chapter === item.id} onClick={() => setChapter(item.id)}>
          {CHAPTERS.find(c => c.id === item.id)?.short} ({item.signed}/{item.total})
        </button>)}
      </div>
      <div className="policy-portfolio-cases">
        {visible.map(item => <article className="policy-portfolio-case" key={item.key}>
          <div className="policy-portfolio-case-heading">
            <h3>{item.dossier.title}</h3>
            <span>{item.signed ? 'Firmado' : item.available ? 'Pendiente' : 'No disponible'}</span>
          </div>
          {item.signed ? <p className="muted">Acto registrado en el historial nacional.</p>
            : !item.available ? <p className="muted">Fuera de su ventana de disponibilidad.</p>
            : item.options.length === 0 ? <p className="muted">No hay alternativas publicadas para esta versión.</p>
            : <label>Medida hipotética
              <select aria-label={'Planificar ' + item.dossier.title}
                value={item.selected?.id ?? ''}
                onChange={event => choose(portfolioKey(item.dossier), event.target.value)}>
                <option value="">No incluir en el borrador</option>
                {item.options.map(option => <option key={option.id} value={option.id}>
                  {option.title} ({option.treasury_delta_m_eur > 0 ? '+' : ''}
                  {number(option.treasury_delta_m_eur)} M€)
                </option>)}
              </select>
              {item.selected && <small className="policy-portfolio-option-explanation">
                {item.selected.description}
              </small>}
            </label>}
          <button type="button" className="text-button"
            onClick={() => onSelect(item.dossier)}>Ver expediente</button>
        </article>)}
        {visible.length === 0 && <p>No hay expedientes en este capítulo.</p>}
      </div>
    </div>}
  </section>
}

