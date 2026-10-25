import { useEffect, useState } from 'react'
import {
  certifyMatchElection, fetchElectionState, setPartyManifesto,
  type ElectionState
} from './lib/elections'
import { matchError } from './lib/multiplayer'
import OpinionHistoryPanel from './OpinionHistoryPanel'

interface Props {
  matchId: string
  userId: string
  active: boolean
  onElectionCertified: () => void
}

export default function ElectionPanel({
  matchId, userId, active, onElectionCertified
}: Props) {
  const [state, setState] = useState<ElectionState | null>(null)
  const [policy, setPolicy] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let alive = true
    setState(null)
    setPolicy(null)
    setError('')
    const refresh = async () => {
      try {
        const next = await fetchElectionState(matchId)
        if (alive) { setState(next); setError('') }
      } catch (reason) {
        if (alive) setError(matchError(reason))
      }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 15000)
    return () => { alive = false; window.clearInterval(interval) }
  }, [matchId, userId])

  const me = state?.projection.parties.find(p => p.userId === userId)
  const current = policy ?? me?.manifestoPolicy ?? 50
  const campaignOpen = !state?.campaignClosesOn ||
    (state.serverDay <= state.campaignClosesOn)
  const latest = state?.history[0]
  const winner = latest?.parties_snapshot.find(p => p.userId === latest.winner_user_id)

  async function run(action: () => Promise<unknown>, success: string, certified = false) {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    let failure: unknown = null
    try { await action() } catch (reason) { failure = reason }
    try {
      // Read the authoritative state before claiming that a change succeeded.
      const fresh = await fetchElectionState(matchId)
      setState(fresh)
      if (failure) setError(matchError(failure))
      else {
        setPolicy(null)
        setNotice(success)
        if (certified) onElectionCertified()
      }
    } catch (reason) {
      setError('No se pudo reconciliar el resultado: ' + matchError(reason))
    } finally { setBusy(false) }
  }

  return <section className="match-panel election-panel" aria-label="Elecciones nacionales">
    <p className="eyebrow">SOBERANÍA POPULAR · REPRESENTACIÓN TERRITORIAL</p>
    <h2>Elecciones nacionales</h2>
    <p className="muted">Los votantes sintéticos ponderan la cercanía ideológica y la
      gestión del Gobierno. Cada 90 días de juego se reparten 100 escaños por
      D’Hondt dentro de seis circunscripciones sintéticas. Una jornada real
      equivale a una jornada de juego.</p>
    {!state ? <p role="status">Calculando el censo y la proyección…</p> : <>
      <div className="election-summary">
        <div><span>PRÓXIMAS URNAS</span>
          <strong>{state.nextDueOn ?? 'Al iniciar la partida'}</strong></div>
        <div><span>CIERRE DE CAMPAÑA</span>
          <strong>{state.campaignClosesOn ?? 'Sin fecha'}</strong></div>
        <div><span>ASAMBLEA</span><strong>100 escaños</strong></div>
        <div><span>REGLA</span><strong>Mayoría: 51</strong></div>
      </div>
      <div className="election-projection">
        <h3>Proyección si se votase hoy</h3>
        <p className="muted">Estimación dinámica, no resultado certificado. La persuasión electoral acumulada se desgasta si los partidos dejan de actuar.</p>
        {state.projection.parties.map(party => <div className="election-party" key={party.userId}>
          <div className="election-party-head">
            <strong>{party.partyName}{party.userId === userId ? ' · TU PARTIDO' : ''}</strong>
            <span>{party.voteSharePct.toFixed(2)}% · {party.seats} escaños</span>
          </div>
          {state.projection.modelVersion === 'electoral-districts-v2' &&
            <small className="muted">Influencia electoral efectiva: {party.campaignInfluenceTotal ?? 0} puntos. Desgaste semanal incluido.</small>}
          <div className="election-track" role="img"
            aria-label={party.partyName + ': ' + party.voteSharePct.toFixed(2) + ' por ciento'}>
            <div style={{ width: party.voteSharePct + '%' }} />
          </div>
          <small>Programa ideológico: {party.manifestoPolicy}/100</small>
        </div>)}
      </div>
      {state.projection.districts && <details className="election-districts">
        <summary>Explorar el escrutinio de seis circunscripciones</summary>
        <p className="muted">Los mandatos de cada territorio se suman para formar
          los 100 escaños del Parlamento. La muestra es sintética.</p>
        <div className="election-district-grid">
          {state.projection.districts.map(district => <article
            className="election-district" key={district.code}>
            <h4>{district.label}</h4>
            <p>{district.households} hogares · {district.residents} integrantes
              · {district.seats} escaños</p>
            <ol>{district.parties.map(party => <li key={party.userId}>
              <span>{party.partyName}</span>
              <strong>{party.seats} / {district.seats}</strong>
            </li>)}</ol>
          </article>)}
        </div>
      </details>}
      {me && <div className="election-manifesto">
        <h3>Programa de {me.partyName}</h3>
        <p className="muted">0 prioriza la redistribución y 100 la libertad económica.
          Puedes cambiar el programa hasta siete días antes de las urnas.</p>
        <label>Posicionamiento: {current}/100
          <input aria-label="Posicionamiento electoral" type="range" min={0} max={100}
            value={current} disabled={busy || !campaignOpen}
            onChange={event => setPolicy(Number(event.target.value))} />
        </label>
        <button disabled={busy || !campaignOpen || current === me.manifestoPolicy}
          onClick={() => void run(
            () => setPartyManifesto(matchId, current),
            'Programa electoral guardado y proyección actualizada.')}>
          Publicar programa
        </button>
        {!campaignOpen && <p role="status">Campaña cerrada: los programas están congelados.</p>}
      </div>}
      {active && state.canCertify && <div className="election-certify">
        <p>Ha llegado la fecha electoral. Cualquier partido puede solicitar el
          escrutinio; la base de datos calcula y certifica el resultado una sola vez.</p>
        <button disabled={busy} onClick={() => void run(
          () => certifyMatchElection(matchId),
          'Elecciones certificadas. El Parlamento y el Gobierno han sido renovados.',
          true)}>Celebrar elecciones</button>
      </div>}
      {latest?.districts_snapshot && latest.districts_snapshot.length > 0 &&
        <details className="election-certified-districts">
          <summary>Acta territorial certificada · {latest.districts_snapshot.length} circunscripciones</summary>
          <p className="muted">El acta conserva el escrutinio original y no se recalcula
            cuando cambian los apoyos o las campañas posteriores.</p>
          <ul>{latest.districts_snapshot.map(district=><li key={district.code}>
            <strong>{district.label}</strong> · {district.seats} escaños
          </li>)}</ul>
        </details>}
      {latest && <div className="election-result" role="status">
        <p className="eyebrow">ACTA ELECTORAL N.º {latest.election_no}</p>
        <h3>Victoria de {winner?.partyName ?? 'partido elegido'}</h3>
        <p>{latest.certified_on} · {winner?.seats ?? 0} de 100 escaños.
          {latest.incumbent_user_id === latest.winner_user_id
            ? ' El Gobierno revalida su mandato.' : ' Se produce alternancia de Gobierno.'}</p>
        <details><summary>Resultado oficial y trazabilidad</summary>
          <ul>{latest.parties_snapshot.map(party => <li key={party.userId}>
            {party.partyName}: {party.voteSharePct.toFixed(2)}% · {party.seats} escaños
          </li>)}</ul>
          <p className="muted">Modelo {latest.model_version}; jornada prevista
            {latest.scheduled_on}. Datos electorales guardados de forma inmutable.</p>
        </details>
      </div>}
    </>}
    {active && state && <OpinionHistoryPanel matchId={matchId} userId={userId} />}
    {notice && <p role="status" className="editorial-success">{notice}</p>}
    {error && <p role="alert" className="editorial-alert">{error}</p>}
  </section>
}
