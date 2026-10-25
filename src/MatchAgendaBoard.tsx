import { useMemo, useState } from 'react'
import type { MatchWorld } from './lib/multiplayer'
import {
  buildMatchAgenda, visibleMatchDossiers, type MatchAgendaFilter,
  type MatchAgendaItem
} from './lib/multiplayerAgenda'
import './MatchAgendaBoard.css'

type Props = {
  world: MatchWorld
  userId: string
  selectedDossierId: string | null
  onSelect: (dossierId: string) => void
}

const filters: ReadonlyArray<{ id: MatchAgendaFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'weekly', label: 'Esta semana' },
  { id: 'foundation', label: 'Programa inicial' },
  { id: 'action', label: 'Mis asuntos pendientes' },
  { id: 'signed', label: 'Decisiones firmadas' }
]

const statusLabels = {
  signed: 'DECISIÓN FIRMADA',
  'stance-recorded': 'POSICIÓN REGISTRADA',
  pending: 'PENDIENTE',
  unavailable: 'FUERA DE PLAZO'
} as const

function summary(total: number, signed: number) {
  return total === 0 ? 'Sin expedientes publicados' : signed + ' / ' + total + ' firmados'
}

export default function MatchAgendaBoard({ world, userId, selectedDossierId, onSelect }: Props) {
  const [filter, setFilter] = useState<MatchAgendaFilter>('all')
  const snapshot = useMemo(() => buildMatchAgenda(world, userId), [world, userId])
  const visible = useMemo(() => visibleMatchDossiers(snapshot, filter), [snapshot, filter])
  const selected = selectedDossierId ?? world.dossiers[0]?.id ?? null

  function open(id: string) {
    onSelect(id)
  }

  function next() {
    if (!snapshot.next) return
    setFilter('all')
    open(snapshot.next.dossier.id)
  }

  return <section className="match-agenda-board" aria-label="Centro de decisiones de la asamblea">
    <header className="match-agenda-header">
      <div>
        <p className="eyebrow">AGENDA COMPARTIDA · ACTAS DEL SERVIDOR</p>
        <h2>Consejo político</h2>
        <p className="muted">Tu función: <strong>{snapshot.role === 'cabinet'
          ? 'Gobierno ejecutivo' : 'Partido de oposición'}</strong>. Las decisiones se ejecutan
          solo con mandato parlamentario y las posiciones de partido no son leyes.</p>
      </div>
      <div className="match-agenda-milestones">
        <div><span>SEMANA POLÍTICA</span><strong>{summary(snapshot.weekly.total, snapshot.weekly.signed)}</strong>
          <small>{snapshot.weekly.stances} posiciones tuyas</small></div>
        <div><span>PROGRAMA PERMANENTE</span><strong>{summary(snapshot.foundation.total, snapshot.foundation.signed)}</strong>
          <small>{snapshot.foundation.stances} posiciones tuyas</small></div>
      </div>
    </header>
    {snapshot.weekly.total === 0 && <p className="match-agenda-advisory" role="status">
      No hay una agenda semanal aprobada para esta fecha. Los expedientes ficticios del
      programa permanente no sustituyen noticias verificadas.
    </p>}
    {snapshot.next && <button type="button" className="match-agenda-next"
      onClick={next}>Ir al siguiente asunto pendiente</button>}
    <div className="match-agenda-filters" role="group" aria-label="Filtros de asuntos políticos">
      {filters.map(item => <button key={item.id} type="button"
        aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''}
        onClick={() => setFilter(item.id)}>{item.label}</button>)}
    </div>
    <div className="match-dossiers match-agenda-list" aria-label="Expedientes políticos disponibles">
      {visible.map(({ dossier, status, hasStance, signed }: MatchAgendaItem) =>
        <button type="button" key={dossier.id + ':' + dossier.version}
          className={selected === dossier.id ? 'selected' : ''}
          aria-pressed={selected === dossier.id} onClick={() => open(dossier.id)}>
          <span className="match-agenda-kind">
            {dossier.release_kind === 'weekly' ? 'PLAZO SEMANAL' : 'ESCENARIO FICTICIO'}
          </span>
          <strong>{dossier.title}</strong>
          <small>{statusLabels[status]}{hasStance && signed ? ' · TU POSICIÓN ARCHIVADA' : ''}</small>
          {dossier.release_kind === 'weekly' && dossier.available_until &&
            <small>Hasta {dossier.available_until} (UTC)</small>}
        </button>)}
      {visible.length === 0 && <p className="match-agenda-empty" role="status">
        No existen asuntos para este filtro. Comprueba las otras categorías.
      </p>}
    </div>
  </section>
}
