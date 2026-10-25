import { useEffect, useMemo, useRef, useState } from 'react'
import type { DossierOption } from './lib/types'
import type { MatchPlayer } from './lib/multiplayer'
import {
  castParliamentVote, fetchParliamentState, finalizeParliamentBill,
  proposeParliamentBill, type ParliamentChoice, type ParliamentState
} from './lib/parliament'
import { matchError } from './lib/multiplayer'

interface Props {
  matchId: string
  dossierId: string
  dossierVersion: number
  options: DossierOption[]
  selectedOptionId: string
  userId: string
  players: MatchPlayer[]
  host: boolean
  decided: boolean
  onMandateChange: (optionId: string | null) => void
}

const voteLabels: Record<ParliamentChoice, string> = {
  yes: 'A favor', no: 'En contra', abstain: 'Abstención'
}

export default function ParliamentPanel({
  matchId, dossierId, dossierVersion, options, selectedOptionId,
  userId, players, host, decided, onMandateChange
}: Props) {
  const [state, setState] = useState<ParliamentState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const revisionRef = useRef(0)
  const aliveRef = useRef(false)
  const mutatingRef = useRef(false)

  useEffect(() => {
    let alive = true
    aliveRef.current = true
    setState(null)
    setError('')
    onMandateChange(null)
    const refresh = async () => {
      if (mutatingRef.current) return
      const revision = ++revisionRef.current
      try {
        const next = await fetchParliamentState(matchId)
        if (!alive || revision !== revisionRef.current) return
        setState(next)
        const passed = next.bills.find(b =>
          b.dossier_id === dossierId && b.status === 'passed')
        onMandateChange(passed?.option_id ?? null)
        setError('')
      } catch (reason) {
        if (alive && revision === revisionRef.current) setError(matchError(reason))
      }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 15000)
    return () => { alive = false; aliveRef.current = false; revisionRef.current++; window.clearInterval(interval) }
  }, [matchId, dossierId, userId, onMandateChange])

  const relevant = useMemo(() => state?.bills.filter(b =>
    b.dossier_id === dossierId) ?? [], [state, dossierId])
  const bill = relevant.find(b => b.status === 'passed') ??
    relevant.find(b => b.status === 'open') ?? relevant[0]
  const ballots = state?.votes.filter(v => v.bill_id === bill?.id) ?? []
  const myVote = ballots.find(v => v.user_id === userId)
  const weight = (v: typeof ballots[number]) => v.seat_weight ?? 10
  const votesYes = ballots.filter(v => v.choice === 'yes').reduce((n,v) => n + weight(v),0)
  const votesNo = ballots.filter(v => v.choice === 'no').reduce((n,v) => n + weight(v),0)
  const votesAbstain = ballots.filter(v => v.choice === 'abstain').reduce((n,v) => n + weight(v),0)
  const totalSeats = players.reduce((n,p) => n + (p.mandate_seats ?? 10),0)
  const eligibleParties = players.filter(p => (p.mandate_seats ?? 10) > 0).length
  const myMandate = players.find(p => p.user_id === userId)?.mandate_seats ?? 10
  const approved = relevant.find(b => b.status === 'passed')
  const billOption = options.find(o => o.id === bill?.option_id)
  const deadlineReached = !!bill && !!state &&
    Date.parse(state.serverNow) >= Date.parse(bill.closes_at)
  const canFinalize = bill?.status === 'open' &&
    (deadlineReached || ballots.length === eligibleParties)

  async function run(action: () => Promise<unknown>, success: string,
    verify: (fresh: ParliamentState) => boolean
  ) {
    if (busy || mutatingRef.current || !aliveRef.current) return
    mutatingRef.current = true
    setBusy(true); setError(''); setNotice('')
    let failure: unknown = null
    try { await action() } catch (reason) { failure = reason }
    const revision = ++revisionRef.current
    // A dropped HTTP response can follow a committed ballot. Reconcile with
    // the immutable server vote/bill rather than pretending it failed.
    try {
      const fresh = await fetchParliamentState(matchId)
      if (!aliveRef.current || revision !== revisionRef.current) return
      setState(fresh)
      const passed = fresh.bills.find(b =>
        b.dossier_id === dossierId && b.status === 'passed')
      onMandateChange(passed?.option_id ?? null)
      if (verify(fresh)) setNotice(success)
      else if (failure) setError(matchError(failure) +
        ' No se confirmó en el acta parlamentaria. Revisa el estado antes de reintentar.')
      else setError('El servidor respondió, pero no aparece el resultado en el acta. ' +
        'Revisa el escrutinio antes de repetir la operación.')
    } catch (reason) {
      if (aliveRef.current && revision === revisionRef.current)
        setError('No se pudo sincronizar el escrutinio: ' + matchError(reason) +
          '. No repitas la acción hasta recuperar el estado.')
    } finally {
      mutatingRef.current = false
      if (aliveRef.current) setBusy(false)
    }
  }

  return <section className="match-panel" aria-label="Votación parlamentaria">
    <p className="eyebrow">PARLAMENTO · LEGISLACIÓN VINCULANTE</p>
    <h3>El mandato de la asamblea</h3>
    <p className="muted">El gobierno propone una medida; los partidos votan.
      La decisión nacional solo puede firmarse tras su aprobación.
      Cada partido emite una papeleta, ponderada por sus escaños. El escrutinio se calcula en el servidor.</p>
    {!state ? <p role="status">Cargando votación…</p> : <>
      {bill && <div className="match-feed">
        <div>
          <span>{bill.status === 'open' ? 'VOTACIÓN ABIERTA' :
            bill.status === 'passed' ? 'LEY APROBADA' : 'PROPUESTA RECHAZADA'}</span>
          <strong>{billOption?.title ?? bill.option_id}</strong>
          <p> A favor {votesYes} · En contra {votesNo} · Abstenciones {votesAbstain} escaños
            · Participación {ballots.length}/{eligibleParties} partidos con mandato</p>
          <p className="muted">Cierre previsto: {new Date(bill.closes_at).toLocaleString('es-ES')}.
            Quórum mínimo: {Math.ceil(totalSeats / 2)} escaños.
            Mayoría absoluta anticipada o mayoría favorable tras el escrutinio.</p>
        </div>
      </div>}
      {bill?.status === 'open' && <>
        {myMandate === 0 ? <p role="status">Tu partido no tiene escaños en esta legislatura.</p> : myVote ? <p role="status" className="match-recorded">
          Tu voto quedó registrado: {voteLabels[myVote.choice]}. No puede modificarse.
        </p> : <div className="review-actions">
          {(['yes','no','abstain'] as const).map(choice =>
            <button key={choice} disabled={busy} onClick={() => void run(
              () => castParliamentVote(bill.id, choice),
              'Voto registrado y escrutinio actualizado.', fresh =>
                fresh.votes.some(v => v.bill_id === bill.id && v.user_id === userId &&
                  v.choice === choice))}>{voteLabels[choice]}</button>)}
        </div>}
        {canFinalize && <button className="text-button" disabled={busy}
          onClick={() => void run(() => finalizeParliamentBill(bill.id),
            'Escrutinio cerrado.', fresh => fresh.bills.some(b =>
              b.id === bill.id && b.status !== 'open'))}>Cerrar escrutinio</button>}
      </>}
      {bill?.status === 'rejected' && <p role="status">
        La propuesta no obtuvo apoyo suficiente. El gobierno puede presentar otra opción.
      </p>}
      {approved && <p role="status" className="match-recorded">
        Mandato aprobado: {options.find(o => o.id === approved.option_id)?.title ??
        approved.option_id}. El gobierno ya puede firmar exactamente esta medida.
      </p>}
      {host && !decided && !approved && bill?.status !== 'open' &&
        <button disabled={busy || !selectedOptionId} onClick={() => void run(
          () => proposeParliamentBill(matchId, dossierId, dossierVersion, selectedOptionId),
          'Propuesta registrada. La asamblea puede votar.', fresh =>
            fresh.bills.some(b => b.dossier_id === dossierId &&
              b.dossier_version === dossierVersion && b.option_id === selectedOptionId &&
              (b.status === 'open' || b.status === 'passed')))}>
          Someter la opción seleccionada a votación
        </button>}
      {!bill && !host && <p role="status">Esperando una propuesta del gobierno.</p>}
    </>}
    {notice && <p role="status" className="editorial-success">{notice}</p>}
    {error && <p role="alert" className="editorial-alert">{error}</p>}
  </section>
}
