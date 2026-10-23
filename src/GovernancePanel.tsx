import { useEffect, useState } from 'react'
import type { MatchPlayer } from './lib/multiplayer'
import { matchError } from './lib/multiplayer'
import {
  castConfidenceVote, fetchGovernanceState, finalizeConfidenceMotion,
  inviteCoalitionPartner, proposeConfidenceMotion, respondCoalitionInvite,
  type ConfidenceVote, type GovernanceState
} from './lib/governance'

interface Props {
  matchId: string
  userId: string
  active: boolean
  players: MatchPlayer[]
  onGovernmentChanged: () => void
}

const labels: Record<ConfidenceVote['choice'], string> = {
  yes: 'Apoyar al candidato', no: 'Mantener el gobierno', abstain: 'Abstenerse'
}

export default function GovernancePanel({
  matchId, userId, active, players, onGovernmentChanged
}: Props) {
  const [snapshot, setSnapshot] = useState<GovernanceState | null>(null)
  const [partner, setPartner] = useState('')
  const [candidate, setCandidate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let alive = true
    setSnapshot(null)
    setPartner('')
    setCandidate('')
    setError('')
    async function refresh() {
      try {
        const fresh = await fetchGovernanceState(matchId)
        if (!alive) return
        setSnapshot(fresh)
      } catch (reason) {
        if (alive) setError(matchError(reason))
      }
    }
    void refresh()
    const poll = window.setInterval(() => { void refresh() }, 15000)
    return () => { alive = false; window.clearInterval(poll) }
  }, [matchId,userId])

  const host = snapshot?.hostUserId === userId
  const incumbent = players.find(p => p.user_id === snapshot?.hostUserId)
  const eligible = players.filter(p => p.mandate_seats > 0)
  const nonCabinet = eligible.filter(p => p.user_id !== snapshot?.hostUserId)
  const open = snapshot?.motions.find(m => m.status === 'open')
  const latest = open ?? snapshot?.motions[0]
  const votes = snapshot?.votes.filter(v => v.motion_id === latest?.id) ?? []
  const ownVote = votes.find(v => v.user_id === userId)
  const affirmative = votes.filter(v => v.choice === 'yes').reduce((sum,v) => sum+v.seat_weight,0)
  const negative = votes.filter(v => v.choice === 'no').reduce((sum,v) => sum+v.seat_weight,0)
  const abstentions = votes.filter(v => v.choice === 'abstain').reduce((sum,v) => sum+v.seat_weight,0)
  const invitation = snapshot?.coalition.find(m => m.user_id === userId)
  const pendingInvites = snapshot?.coalition.filter(m => m.status === 'invited') ?? []
  const eligiblePartners = nonCabinet.filter(p =>
    !snapshot?.coalition.some(c => c.user_id === p.user_id &&
      (c.status === 'invited' || c.status === 'accepted')))
  const expired = !!open && !!snapshot && Date.parse(snapshot.serverNow) >= Date.parse(open.closes_at)

  async function execute(action: () => Promise<unknown>, success: string) {
    if (busy || !active) return
    setBusy(true)
    setError('')
    setNotice('')
    let failed: unknown
    try { await action() } catch (reason) { failed = reason }
    try {
      const fresh = await fetchGovernanceState(matchId)
      setSnapshot(fresh)
      if (fresh.hostUserId !== snapshot?.hostUserId) onGovernmentChanged()
      if (failed) setError(matchError(failed))
      else setNotice(success)
    } catch (reason) {
      setError('No se pudo sincronizar la gobernanza: ' + matchError(reason))
    } finally { setBusy(false) }
  }

  const playerName = (id: string) =>
    players.find(p => p.user_id === id)?.party_name ?? 'Partido desconocido'

  return <section className="match-panel governance-panel" aria-label="Gobierno, coaliciones y mociones de censura">
    <p className="eyebrow">PODER EJECUTIVO · NEGOCIACIÓN PARLAMENTARIA</p>
    <h3>Coaliciones y responsabilidad política</h3>
    {!snapshot ? <p role="status">Recuperando acuerdos y mandatos…</p> : <>
      <div className="governance-mandates">
        <div><span>GOBIERNO ACTUAL</span><strong>{incumbent?.party_name ?? 'Sin gobierno'}</strong></div>
        <div><span>APOYO DE COALICIÓN</span><strong>{snapshot.coalitionSeats} / {snapshot.totalSeats} escaños</strong></div>
        <div><span>MAYORÍA ABSOLUTA</span><strong>{Math.floor(snapshot.totalSeats / 2) + 1} escaños</strong></div>
      </div>
      <p className="muted">Las alianzas requieren aceptación voluntaria. Cada partido conserva su voto parlamentario; una coalición no transfiere automáticamente escaños ni autoridad para firmar leyes.</p>
      {host && active && <div className="governance-form">
        <label htmlFor="coalition-party">Invitar a un partido al gobierno
          <select id="coalition-party" value={partner} disabled={busy}
            onChange={event => setPartner(event.target.value)}>
            <option value="">Seleccionar partido</option>
            {eligiblePartners.map(p => <option key={p.user_id} value={p.user_id}>{p.party_name}</option>)}
          </select>
        </label>
        <button type="button" disabled={!partner || busy} onClick={() => void execute(
          () => inviteCoalitionPartner(matchId,partner), 'Invitación enviada. La aceptación depende del partido invitado.'
        )}>Proponer coalición</button>
      </div>}
      {invitation?.status === 'invited' && <div className="governance-invitation">
        <p>El partido {playerName(invitation.leader_id)} te invita a formar parte de su coalición.</p>
        <div className="review-actions">
          <button disabled={busy} onClick={() => void execute(
            () => respondCoalitionInvite(matchId,true), 'Coalición aceptada y escaños actualizados.')}>Aceptar invitación</button>
          <button disabled={busy} onClick={() => void execute(
            () => respondCoalitionInvite(matchId,false), 'Invitación rechazada.')}>Rechazar invitación</button>
        </div>
      </div>}
      {invitation?.status === 'accepted' && <div className="governance-invitation">
        <p>Tu partido forma parte de la coalición del gobierno.</p>
        <button disabled={busy} onClick={() => void execute(
          () => respondCoalitionInvite(matchId,false), 'Tu partido ha abandonado la coalición.')}>Abandonar coalición</button>
      </div>}
      {snapshot.coalition.filter(c => c.status === 'accepted').length>0 && <p>
        <strong>Socios actuales:</strong> {' '}
        {snapshot.coalition.filter(c => c.status === 'accepted')
          .map(c => playerName(c.user_id)).join(', ')}
      </p>}
      {host && pendingInvites.length>0 && <p className="muted">
        Invitaciones pendientes: {pendingInvites.map(c => playerName(c.user_id)).join(', ')}.
      </p>}
      <div className="governance-confidence">
        <p className="eyebrow">MOCIÓN DE CENSURA CONSTRUCTIVA</p>
        <h4>Proponer otro gobierno</h4>
        <p className="muted">Un partido con escaños puede designar un candidato alternativo. El candidato asume el gobierno únicamente con mayoría absoluta de los escaños. Los votos son públicos, personales e irreversibles; el cierre se produce tras 24 horas o al terminar el escrutinio.</p>
        {open ? <>
          <p role="status">Moción abierta para investir a <strong>{playerName(open.candidate_id)}</strong>.
            Cierre: {new Date(open.closes_at).toLocaleString('es-ES')}.</p>
          <p>A favor: {affirmative} · En contra: {negative} · Abstenciones: {abstentions}.
            Participación: {votes.length}/{eligible.length} partidos con mandato.</p>
          {ownVote ? <p className="match-recorded" role="status">Tu voto: {labels[ownVote.choice]}.</p>
          : eligible.some(p => p.user_id===userId) && !expired && <div className="review-actions">
            {(['yes','no','abstain'] as const).map(choice =>
              <button key={choice} disabled={busy || !active} onClick={() => void execute(
                () => castConfidenceVote(open.id,choice), 'Voto de confianza registrado.'
              )}>{labels[choice]}</button>)}
          </div>}
          {expired && <button disabled={busy} onClick={() => void execute(
            () => finalizeConfidenceMotion(open.id), 'Escrutinio finalizado.'
          )}>Cerrar votación vencida</button>}
        </> : active && eligible.some(p => p.user_id === userId) ? <div className="governance-form">
          <label htmlFor="confidence-candidate">Candidato alternativo
            <select id="confidence-candidate" value={candidate} disabled={busy}
              onChange={event => setCandidate(event.target.value)}>
              <option value="">Seleccionar candidato</option>
              {nonCabinet.map(p => <option key={p.user_id} value={p.user_id}>{p.party_name}</option>)}
            </select>
          </label>
          <button type="button" disabled={busy || !candidate} onClick={() => void execute(
            () => proposeConfidenceMotion(matchId,candidate), 'Moción registrada. Votación de 24 horas abierta.'
          )}>Registrar moción</button>
        </div> : null}
        {latest && latest.status !== 'open' && <div role="status" className="match-recorded">
          Última moción: {latest.status === 'passed' ? 'APROBADA · nuevo gobierno' :
            'RECHAZADA · continúa el gobierno'} ({playerName(latest.candidate_id)}).
        </div>}
        <p className="muted">El cambio de gobierno se calcula y ejecuta exclusivamente en el servidor. Ningún usuario puede asignarse escaños ni reemplazar al gobernante mediante el navegador.</p>
      </div>
      {notice && <p className="editorial-success" role="status">{notice}</p>}
    </>}
    {error && <p className="editorial-alert" role="alert">{error}</p>}
  </section>
}
