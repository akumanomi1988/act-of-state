import { useMemo, useState } from 'react'
import type { MatchWorld } from './lib/multiplayer'
import type {PublicLanguage} from './lib/publicLanguage'
import {
  buildMatchAgenda, visibleMatchDossiers, type MatchAgendaFilter,
  type MatchAgendaItem
} from './lib/multiplayerAgenda'
import './MatchAgendaBoard.css'

type Props = {
  world: MatchWorld
  userId: string
  language?:PublicLanguage
  selectedDossierId: string | null
  onSelect: (dossierId: string) => void
}

const filters: ReadonlyArray<{ id: MatchAgendaFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'weekly', label: 'Esta semana' },
  { id: 'foundation', label: 'Programa inicial' },
  { id: 'reforms', label: 'Reformas' },
  { id: 'society', label: 'Sociedad' },
  { id: 'economy', label: 'Economía' },
  { id: 'institutions', label: 'Instituciones' },
  { id: 'resilience', label: 'Resiliencia' },
  { id: 'diplomacy', label: 'Diplomacia' },
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

export default function MatchAgendaBoard({ world, userId, selectedDossierId, onSelect, language='es' }: Props) {
  const en=language==='en'
  const t=(es:string,english:string)=>en?english:es
  const [filter, setFilter] = useState<MatchAgendaFilter>('all')
  const snapshot = useMemo(() => buildMatchAgenda(world, userId), [world, userId])
  const visible = useMemo(() => visibleMatchDossiers(snapshot, filter), [snapshot, filter])
  const selected = selectedDossierId ?? world.dossiers[0]?.id ?? null
  const filterEnglish:Readonly<Record<MatchAgendaFilter,string>>={all:'All',weekly:'This week',foundation:'Founding programme',reforms:'Reforms',society:'Society',economy:'Economy',institutions:'Institutions',resilience:'Resilience',diplomacy:'Diplomacy',action:'My pending actions',signed:'Signed decisions'}
  const statuses={signed:'SIGNED DECISION','stance-recorded':'POSITION RECORDED',pending:'PENDING',unavailable:'OUTSIDE THE WINDOW'} as const
  const summarize=(total:number,signed:number)=>en?(total===0?'No published dossiers':signed+' / '+total+' signed'):summary(total,signed)

  function open(id: string) {
    onSelect(id)
  }

  function next() {
    if (!snapshot.next) return
    setFilter('all')
    open(snapshot.next.dossier.id)
  }

  return <section className="match-agenda-board" aria-label={t('Centro de decisiones de la asamblea','Assembly decision centre')}>
    <header className="match-agenda-header">
      <div>
        <p className="eyebrow">{t('AGENDA COMPARTIDA · ACTAS DEL SERVIDOR','SHARED AGENDA · SERVER-VERIFIED RECORDS')}</p>
        <h2>{t('Consejo político','Political council')}</h2>
        <p className="muted">{t('Tu función:','Your role:')} <strong>{snapshot.role === 'cabinet'
          ? t('Gobierno ejecutivo','Executive cabinet') : t('Partido de oposición','Opposition party')}</strong>. {t('Las decisiones se ejecutan solo con mandato parlamentario y las posiciones de partido no son leyes.','Only a parliamentary mandate permits an official decision; a party position alone is not a law.')}</p>
      </div>
      <div className="match-agenda-milestones">
        <div><span>{t('SEMANA POLÍTICA','POLITICAL WEEK')}</span><strong>{summarize(snapshot.weekly.total, snapshot.weekly.signed)}</strong>
          <small>{snapshot.weekly.stances} {t('posiciones tuyas','your positions')}</small></div>
        <div><span>{t('PROGRAMA PERMANENTE','PERMANENT PROGRAMME')}</span><strong>{summarize(snapshot.foundation.total, snapshot.foundation.signed)}</strong>
          <small>{snapshot.foundation.stances} {t('posiciones tuyas','your positions')}</small></div>
        <div><span>{t('REFORMAS NACIONALES · FICCIÓN','NATIONAL REFORMS · FICTION')}</span>
          <strong>{summarize(snapshot.reforms.total, snapshot.reforms.signed)}</strong>
          <small>{snapshot.reforms.stances} {t('posiciones tuyas','your positions')}</small></div>
      </div>
    </header>
    {snapshot.weekly.total === 0 && <p className="match-agenda-advisory" role="status">
      {t('No hay una agenda semanal aprobada para esta fecha. Los expedientes ficticios del programa permanente no sustituyen noticias verificadas.','No weekly editorial slate is approved for this date. Permanent fictional dossiers must not be mistaken for verified news.')}
    </p>}
    {snapshot.next && <button type="button" className="match-agenda-next"
      onClick={next}>{t('Ir al siguiente asunto pendiente','Open next pending item')}</button>}
    <div className="match-agenda-filters" role="group" aria-label={t('Filtros de asuntos políticos','Political agenda filters')}>
      {filters.map(item => <button key={item.id} type="button"
        aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''}
        onClick={() => setFilter(item.id)}>{en?filterEnglish[item.id]:item.label}</button>)}
    </div>
    <div className="match-dossiers match-agenda-list" aria-label={t('Expedientes políticos disponibles','Available political dossiers')}>
      {visible.map(({ dossier, status, hasStance, signed }: MatchAgendaItem) =>
        <button type="button" key={dossier.id + ':' + dossier.version}
          className={selected === dossier.id ? 'selected' : ''}
          aria-pressed={selected === dossier.id} onClick={() => open(dossier.id)}>
          <span className="match-agenda-kind">
            {dossier.release_kind === 'weekly' ? t('PLAZO SEMANAL','WEEKLY DEADLINE') :
              dossier.programme_chapter && dossier.programme_chapter !== 'founding'
                ? t('REFORMA FICTICIA · ','FICTIONAL REFORM · ') + dossier.programme_chapter.toUpperCase()
                : t('PROGRAMA INICIAL FICTICIO','FICTIONAL FOUNDING PROGRAMME')}
          </span>
          <strong>{dossier.title}</strong>{en&&<small>Original editorial title (Spanish)</small>}
          <small>{en?statuses[status]:statusLabels[status]}{hasStance && signed ? t(' · TU POSICIÓN ARCHIVADA',' · YOUR POSITION ARCHIVED') : ''}</small>
          {dossier.release_kind === 'weekly' && dossier.available_until &&
            <small>{t('Hasta','Until')} {dossier.available_until} (UTC)</small>}
        </button>)}
      {visible.length === 0 && <p className="match-agenda-empty" role="status">
        {t('No existen asuntos para este filtro. Comprueba las otras categorías.','No items match this filter. Check the other categories.')}
      </p>}
    </div>
  </section>
}
