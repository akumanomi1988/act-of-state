import { useMemo, useState } from 'react'
import type { DecisionEvent, Dossier, GovernmentWorld } from './lib/types'
import { number } from './lib/format'
import './FoundationalAgendaPanel.css'

type AgendaFilter = 'all' | 'weekly' | 'foundational' | 'pending' | 'completed'

export interface FoundationalAgendaProps {
  world: GovernmentWorld
  selectedKey: string | null
  onSelect: (dossier: Dossier) => void
}

const FILTERS: readonly { key: AgendaFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'weekly', label: 'Esta semana' },
  { key: 'foundational', label: 'Programa de gobierno' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'completed', label: 'Firmados' }
]

export function dossierKey(dossier: Dossier): string {
  return dossier.id + ':' + dossier.version
}

export function isAvailable(dossier: Dossier, day: string): boolean {
  return (!dossier.available_from || day >= dossier.available_from) &&
    (!dossier.available_until || day <= dossier.available_until)
}

/**
 * The source of truth remains the signed immutable event. Sum only within-event
 * before/after deltas, never subtract against today's government state: fiscal
 * settlements and daily social ticks occur between political decisions.
 */
export function foundationalProgress(dossiers: Dossier[], events: DecisionEvent[]) {
  const foundation = dossiers.filter(item => item.release_kind === 'intro')
  const foundationIds = new Set(foundation.map(item => item.id))
  const eventByDossier = new Map(events.map(event => [event.dossier_id, event]))
  const signed = events.filter(event => foundationIds.has(event.dossier_id))
  const delta = (field: 'treasury_m_eur' | 'approval' | 'trust') =>
    signed.reduce((sum, event) => sum + event.state_after[field] - event.state_before[field], 0)
  return {
    total: foundation.length,
    completed: foundation.filter(item => eventByDossier.has(item.id)).length,
    treasuryDelta: delta('treasury_m_eur'),
    approvalDelta: delta('approval'),
    trustDelta: delta('trust'),
    next: foundation.find(item => !eventByDossier.has(item.id)) ?? null,
    signed
  }
}

export default function FoundationalAgendaPanel({ world, selectedKey, onSelect }: FoundationalAgendaProps) {
  const [filter, setFilter] = useState<AgendaFilter>('all')
  const progress = useMemo(() =>
    foundationalProgress(world.dossiers, world.events), [world.dossiers, world.events])
  const signedIds = useMemo(() =>
    new Set(world.events.map(event => event.dossier_id)), [world.events])
  const visible = useMemo(() => world.dossiers.filter(item => {
    const done = signedIds.has(item.id)
    if (filter === 'foundational') return item.release_kind === 'intro'
    if (filter === 'weekly') return item.release_kind === 'weekly'
    if (filter === 'pending') return !done && isAvailable(item, world.gameDay)
    if (filter === 'completed') return done
    return true
  }).sort((a, b) => {
    // Time-limited legislative deadlines take priority over the permanent
    // fictional programme. Preserve stable database order within each group.
    return (a.release_kind === 'weekly' ? 0 : 1) -
      (b.release_kind === 'weekly' ? 0 : 1)
  }), [world.dossiers, world.gameDay, filter, signedIds])

  return <section className="foundation-agenda" aria-label="Programa político y expedientes">
    <div className="foundation-overview">
      <div className="eyebrow">PROGRAMA FUNDACIONAL · EXPEDIENTES FICTICIOS</div>
      <div className="foundation-heading">
        <h2>Construye tu programa</h2>
        <strong>{progress.completed} / {progress.total}</strong>
      </div>
      {progress.total > 0 ? <div className="foundation-progress" role="progressbar"
        aria-label="Decisiones del programa firmadas" aria-valuemin={0}
        aria-valuemax={progress.total} aria-valuenow={progress.completed}>
        <span style={{ width: 100 * progress.completed / progress.total + '%' }} />
      </div> : <p className="muted">No hay expedientes fundacionales publicados.</p>}
      <p className="foundation-description">Decisiones definitivas, registradas en el servidor.
        Cada política cambia la nación; el orden de elección es libre.</p>
      {progress.completed > 0 && <div className="foundation-balance"
        aria-label="Impactos acumulados de las decisiones fundacionales">
        <div><span>EFECTO FISCAL FIRMADO</span><strong>{progress.treasuryDelta > 0 ? '+' : ''}{number(progress.treasuryDelta)} M€</strong></div>
        <div><span>APROBACIÓN · ACTOS</span><strong>{progress.approvalDelta > 0 ? '+' : ''}{number(progress.approvalDelta)} pp</strong></div>
        <div><span>CONFIANZA · ACTOS</span><strong>{progress.trustDelta > 0 ? '+' : ''}{number(progress.trustDelta)} pp</strong></div>
      </div>}
      {progress.completed > 0 && <p className="foundation-disclaimer">
        Suma de cambios registrados en cada firma; no incluye la evolución diaria,
        los cierres fiscales ni equivale al estado actual del país.</p>}
      {progress.next ? <button className="text-button foundation-next" type="button"
        onClick={() => { onSelect(progress.next!); setFilter('all') }}>
        Continuar programa · {progress.next.title}
      </button> : progress.total > 0 &&
        <p className="foundation-finished" role="status">Programa inicial completado.
          Tu mandato continúa con el calendario y los expedientes semanales.</p>}
    </div>

    <div className="section-heading">
      <h2>Expedientes</h2>
      <span>{world.dossiers.length} disponibles</span>
    </div>
    <div className="foundation-filters" role="group" aria-label="Filtrar expedientes">
      {FILTERS.map(item => <button className={filter === item.key ? 'active' : ''}
        type="button" key={item.key} aria-pressed={filter === item.key}
        onClick={() => setFilter(item.key)}>{item.label}</button>)}
    </div>
    <div className="dossier-list">
      {visible.map(item => {
        const done = signedIds.has(item.id)
        const usable = isAvailable(item, world.gameDay)
        return <button type="button"
          className={'dossier-item ' + (selectedKey === dossierKey(item) ? 'selected' : '')}
          key={dossierKey(item)} onClick={() => onSelect(item)}
          aria-pressed={selectedKey === dossierKey(item)}>
          <span className="eyebrow">{item.category.toUpperCase()} · V{item.version}</span>
          <strong>{item.title}</strong>
          <small>{done ? 'FIRMADO' : usable ? 'PENDIENTE' : 'NO DISPONIBLE'}
            {' · '}{item.release_kind === 'intro' ? 'FICTICIO' : 'SEMANAL'}</small>
        </button>
      })}
      {visible.length === 0 && <p className="muted" role="status">
        No hay expedientes para este filtro. Prueba otra categoría.</p>}
    </div>
  </section>
}
