import PlayerOnboarding from './PlayerOnboarding'
import { PasswordSignIn, AccountPasswordPanel } from './PasswordAccess'
import MatchAgendaBoard from './MatchAgendaBoard'
import PolicyPortfolioPanel from './PolicyPortfolioPanel'
import WeeklyMissionControl from './WeeklyMissionControl'
import { buildMatchAgenda } from './lib/multiplayerAgenda'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { client, friendlyError, submitDecision } from './lib/game'
import { number } from './lib/format'
import ParliamentPanel from './ParliamentPanel'
import ElectionPanel from './ElectionPanel'
import CampaignPanel from './CampaignPanel'
import PopulationPanel from './PopulationPanel'
import MatchCalendarPanel from './MatchCalendarPanel'
import WeeklyAccountabilityPanel from './WeeklyAccountabilityPanel'
import ActionInboxPanel from './ActionInboxPanel'
import type {InboxSection} from './lib/actionInbox'
import GovernancePanel from './GovernancePanel'
import FiscalPanel from './FiscalPanel'
import LivingConditionsPanel from './LivingConditionsPanel'
import DecisionAnalyticsPanel from './DecisionAnalyticsPanel'
import PublicMatchPanel from './PublicMatchPanel'
import { joinPublicLobby, setMatchVisibility } from './lib/matchmaking'
import {
  setMatchReady,setMatchReadinessRequirement,leaveLobby,
  invitationUrl,inviteCodeFromQuery,isInviteCode
} from './lib/lobby'
import {
  createMatch, fetchMatchWorld, joinMatch, listMyMatches, matchError,
  recordMatchStance, startMatch, type MatchSummary, type MatchWorld
} from './lib/multiplayer'

export default function MultiplayerApp() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [mailSent, setMailSent] = useState(false)
  const [title, setTitle] = useState('')
  const [hostParty, setHostParty] = useState('')
  const [inviteCode, setInviteCode] = useState(() => inviteCodeFromQuery(window.location.search) ?? '')
  const [joiningParty, setJoiningParty] = useState('')
  const [matches, setMatches] = useState<MatchSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [world, setWorld] = useState<MatchWorld | null>(null)
  const [selectedDossierId, setSelectedDossierId] = useState<string | null>(null)
  const [selectedOptionId, setSelectedOptionId] = useState('')
  const [reviewCabinet, setReviewCabinet] = useState(false)
  const [mandateOptionId, setMandateOptionId] = useState<string | null>(null)
  const [uncertainDossierId, setUncertainDossierId] = useState<string | null>(null)
  const signatureUncertain = uncertainDossierId !== null
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [shareFailure,setShareFailure] = useState('')
  const ownerRef = useRef<string | null>(null)
  const requestRef = useRef(0)

  function acceptUser(next: User | null) {
    const id = next?.id ?? null
    if (ownerRef.current !== id) {
      ownerRef.current = id
      requestRef.current += 1
      setPending(false)
      setActiveId(null)
      setWorld(null)
      setMandateOptionId(null)
      setUncertainDossierId(null)
      setMatches([])
      setError('')
    }
    setUser(next)
  }

  useEffect(() => {
    if (!client) { setAuthReady(true); return }
    let alive = true
    let authRevision = 0
    const initial = authRevision
    client.auth.getUser().then(({ data, error: authError }) => {
      if (!alive || authRevision !== initial) return
      acceptUser(authError ? null : data.user)
      setAuthReady(true)
    }).catch(() => { if (alive) setAuthReady(true) })
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      if (event !== 'INITIAL_SESSION') authRevision += 1
      acceptUser(session?.user ?? null)
      setAuthReady(true)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    const owner = user.id
    const load = async () => {
      try {
        const list = await listMyMatches()
        if (!alive || ownerRef.current !== owner) return
        setMatches(list)
        setActiveId(current => current && list.some(match => match.id === current)
          ? current : list[0]?.id ?? null)
      } catch (reason) {
        if (alive && ownerRef.current === owner) setError(matchError(reason))
      }
    }
    void load()
    return () => { alive = false }
  }, [user?.id, reload])

  useEffect(() => {
    if (!user || !activeId) { setWorld(null); return }
    const owner = user.id
    const id = activeId
    const request = ++requestRef.current
    let alive = true
    setWorld(null)
    setLoading(true)
    setSelectedDossierId(null)
    setSelectedOptionId('')
    setReviewCabinet(false)
    setMandateOptionId(null)
    setUncertainDossierId(null)
    const refresh = async () => {
      try {
        const fresh = await fetchMatchWorld(id)
        if (!alive || ownerRef.current !== owner || requestRef.current !== request) return
        if (fresh.me.user_id !== owner) throw new Error('MATCH_FORBIDDEN')
        // Server events are append-only. An earlier polling response must never
        // visually erase an already confirmed act from a newer RPC snapshot.
        setWorld(previous => {
          if (!previous || previous.match.id !== id || previous.me.user_id !== owner)
            return fresh
          const returnedIds = new Set(fresh.events.map(event => event.id))
          return previous.events.some(event => !returnedIds.has(event.id)) ? previous : fresh
        })
      } catch (reason) {
        if (alive && ownerRef.current === owner && requestRef.current === request)
          setError(matchError(reason))
      } finally {
        if (alive && ownerRef.current === owner && requestRef.current === request)
          setLoading(false)
      }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() }, 15000)
    return () => { alive = false; requestRef.current += 1; window.clearInterval(interval) }
  }, [user?.id, activeId, reload])

  const agenda = useMemo(() => world && user ? buildMatchAgenda(world, user.id) : null,
    [world, user?.id])
  const dossier = useMemo(() => world?.dossiers.find(item => item.id === selectedDossierId)
    ?? agenda?.next?.dossier ?? agenda?.items[0]?.dossier ?? null,
    [world, selectedDossierId, agenda])
  const options = useMemo(() => world?.options.filter(option =>
    option.dossier_id === dossier?.id && option.dossier_version === dossier?.version) ?? [],
  [world, dossier])
  const selectedOption = options.find(option => option.id === selectedOptionId)
  const myStance = world?.stances.find(stance =>
    stance.user_id === user?.id && stance.dossier_id === dossier?.id)
  const cabinetEvent = world?.events.find(event => event.dossier_id === dossier?.id)
  const host = !!world && world.match.host_user_id === user?.id
  const active = world?.match.status === 'active'
  const mandateReady = !!mandateOptionId && selectedOptionId === mandateOptionId

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) return
    setPending(true); setError('')
    try {
      const { error: authError } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: isInviteCode(inviteCode) ?
          invitationUrl(window.location.origin,inviteCode) :
          window.location.origin + '/multiplayer' }
      })
      if (authError) setError(friendlyError(authError))
      else setMailSent(true)
    } catch (reason) { setError(friendlyError(reason)) }
    finally { setPending(false) }
  }

  async function mutate(action: () => Promise<unknown>, success: string, selectId?: string) {
    if (!user || pending) return
    const owner = user.id
    setPending(true); setError(''); setNotice('')
    try {
      await action()
      if (ownerRef.current !== owner) return
      if (selectId) setActiveId(selectId)
      setNotice(success)
      setReload(value => value + 1)
    } catch (reason) {
      if (ownerRef.current === owner) setError(matchError(reason))
    } finally {
      if (ownerRef.current === owner) setPending(false)
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim() || !hostParty.trim()) return
    await mutate(async () => {
      const match = await createMatch(title.trim(), hostParty.trim())
      setActiveId(match.id)
    }, 'Partida creada. Comparte el código con hasta nueve partidos.')
  }

  async function onJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!inviteCode.trim() || !joiningParty.trim()) return
    await mutate(async () => {
      const seat = await joinMatch(inviteCode.trim(), joiningParty.trim())
      setActiveId(seat.match_id)
    }, 'Te has unido a la partida. Tu partido tiene plaza persistente.')
  }

  async function onLeaveLobby() {
    if (!world || world.match.status!=='lobby' || host || pending) return
    const matchId=world.match.id
    await mutate(()=>leaveLobby(matchId),
      'Has abandonado la convocatoria. El escaño vuelve a estar disponible.')
  }

  async function shareInvite() {
    if (!world) return
    setShareFailure('')
    try {
      const url=invitationUrl(window.location.origin,world.match.invite_code)
      if (!navigator.clipboard?.writeText) throw new Error('CLIPBOARD_UNAVAILABLE')
      await navigator.clipboard.writeText(url)
      setNotice('Enlace de invitación copiado.')
    } catch {
      setShareFailure('No se pudo copiar el enlace. Comparte el código que aparece arriba.')
    }
  }

  async function onStance() {
    if (!world || !dossier || !selectedOption || myStance || !active) return
    await mutate(() => recordMatchStance(world.match.id,dossier.id,dossier.version,
      selectedOption.id), 'Posición política registrada. El índice de afinidad procede del cálculo del servidor.')
  }

  /**
   * A committed decision can outlive a dropped HTTP response. Never call it a
   * success unless a fresh server world contains exactly the signed option.
   * An ambiguous response locks the signature until explicit reconciliation.
   */
  async function onCabinetDecision() {
    if (!world || !dossier || !selectedOption || !host || !active ||
      cabinetEvent || !reviewCabinet || !mandateReady || signatureUncertain || pending || !user) return
    const owner = user.id
    const matchId = world.match.id
    const governmentId = world.government.id
    const choiceId = selectedOption.id
    const dossierId = dossier.id
    const dossierVersion = dossier.version
    const revision = requestRef.current
    setPending(true); setError(''); setNotice('')
    let failed: unknown = null
    try {
      await submitDecision(governmentId, dossierId, dossierVersion, choiceId)
    } catch (reason) { failed = reason }
    try {
      const persisted = await fetchMatchWorld(matchId)
      if (ownerRef.current !== owner || requestRef.current !== revision) return
      if (persisted.match.id !== matchId || persisted.me.user_id !== owner ||
          persisted.government.id !== governmentId) throw new Error('MATCH_FORBIDDEN')
      setWorld(persisted)
      const signed = persisted.events.find(event => event.dossier_id === dossierId)
      if (signed) {
        setReviewCabinet(false)
        setSelectedOptionId('')
        setMandateOptionId(null)
        setUncertainDossierId(null)
        if (signed.option_id === choiceId && signed.dossier_version === dossierVersion) {
          setNotice('Firma confirmada en el servidor. Los diez partidos comparten el nuevo estado nacional.')
        } else {
          setError('El servidor registra una opción diferente. No se ha repetido la firma.')
        }
      } else {
        setUncertainDossierId(dossierId)
        setError((failed ? matchError(failed) + ' ' : '') +
          'No podemos confirmar la firma. Sincroniza el gobierno antes de intentarlo otra vez.')
      }
    } catch (reason) {
      if (ownerRef.current === owner && requestRef.current === revision) {
        setUncertainDossierId(dossierId)
        setError('El resultado de la firma es incierto: ' + matchError(reason) +
          '. Sincroniza el gobierno antes de continuar.')
      }
    } finally {
      if (ownerRef.current === owner && requestRef.current === revision) setPending(false)
    }
  }

  async function reconcileCabinet() {
    if (!world || !user || !signatureUncertain || pending) return
    const owner = user.id
    const revision = requestRef.current
    const matchId = world.match.id
    const dossierId = uncertainDossierId
    setPending(true); setError(''); setNotice('')
    try {
      const persisted = await fetchMatchWorld(matchId)
      if (ownerRef.current !== owner || requestRef.current !== revision) return
      if (persisted.match.id !== matchId || persisted.me.user_id !== owner ||
          persisted.government.id !== world.government.id) throw new Error('MATCH_FORBIDDEN')
      setWorld(persisted)
      setUncertainDossierId(null)
      setReviewCabinet(false)
      setSelectedOptionId('')
      setMandateOptionId(null)
      const event = persisted.events.find(item => item.dossier_id === dossierId)
      setNotice(event ? 'Firma encontrada en el historial oficial. Se ha actualizado el gabinete.'
        : 'Sin firma registrada en el estado oficial. Puedes revisar una opción de nuevo.')
    } catch (reason) {
      if (ownerRef.current === owner && requestRef.current === revision)
        setError('No se pudo sincronizar la firma: ' + matchError(reason))
    } finally {
      if (ownerRef.current === owner && requestRef.current === revision) setPending(false)
    }
  }

  async function onSignOut() {
    if (!client) return
    setPending(true); setError('')
    const { error: authError } = await client.auth.signOut()
    if (authError) setError(friendlyError(authError))
    setPending(false)
  }

  return <div className="app-shell">
    <header className="masthead">
      <div className="brand-group">
        <div className="brand-symbol" aria-hidden="true">A<span>✦</span>S</div>
        <div><div className="wordmark">ACT OF STATE</div>
          <div className="brand-caption">MULTIPLAYER NATIONAL ASSEMBLY</div></div>
      </div>
      <div className="header-end"><a className="text-button" href="/guide">Manual del jugador</a><a className="text-button" href="/status">Estado del servicio</a><a className="text-button" href="/">Gobierno</a>
        <a className="text-button" href="/editorial">Editorial</a>
        {user && <button className="text-button" disabled={pending}
          onClick={() => void onSignOut()}>Cerrar sesión</button>}</div>
    </header>
    <div className="session-strip"><span>PARTIDAS ASÍNCRONAS · HASTA 10 PARTIDOS</span>
      <span>UN ESTADO NACIONAL COMPARTIDO</span></div>

    {!authReady ? <main className="match-entry"><p role="status">Comprobando identidad…</p></main>
    : !client ? <main className="match-entry"><h1>Servidor no configurado</h1>
      <p className="muted">Conecta el proyecto ACT OF STATE.</p></main>
    : !user ? <main className="match-entry">
      <p className="eyebrow">ASAMBLEA NACIONAL</p><h1>El poder no se ejerce solo.</h1>
      <p className="muted">Diez partidos, una nación persistente. Inicia sesión para fundar o unirte a una partida.</p>
      <PasswordSignIn email={email} onEmailChange={setEmail} onError={setError}
        redirectTo={isInviteCode(inviteCode)
          ? invitationUrl(window.location.origin,inviteCode)
          : window.location.origin+'/multiplayer'} disabled={pending} />
      <p>¿Aún no tienes contraseña? Usa el enlace una vez y configúrala en la cuenta.</p>
      <form className="match-form" onSubmit={event => void onLogin(event)}>
        <label>Correo electrónico
          <input type="email" value={email} required autoComplete="email"
            onChange={event => setEmail(event.target.value)} />
        </label>
        <button disabled={pending} type="submit">Recibir enlace de acceso</button>
      </form>
      {mailSent && <p role="status">Enlace enviado a tu correo.</p>}
      {error && <p role="alert" className="editorial-alert">{error}</p>}
    </main>
    : <main className="match-layout">
      <aside className="match-sidebar">
        <p className="eyebrow">CENTRO DE PARTIDAS</p><h1>Tu asamblea</h1>
        <AccountPasswordPanel />
        <div className="match-panel">
          <h3>Crear partida</h3>
          <form className="match-form" onSubmit={event => void onCreate(event)}>
            <label>Nombre de la partida
              <input aria-label="Nombre de la partida" value={title} maxLength={80}
                onChange={event => setTitle(event.target.value)} required minLength={3}
                placeholder="Legislatura de Arcadia" /></label>
            <label>Nombre de tu partido
              <input aria-label="Nombre del partido anfitrión" value={hostParty} maxLength={60}
                onChange={event => setHostParty(event.target.value)} required minLength={3}
                placeholder="Coalición Cívica" /></label>
            <button disabled={pending} type="submit">Fundar partida</button>
          </form>
        </div>
        <div className="match-panel">
          <h3>Unirse por invitación</h3>
          <form className="match-form" onSubmit={event => void onJoin(event)}>
            <label>Código de invitación
              <input aria-label="Código de invitación" value={inviteCode}
                onChange={event => setInviteCode(event.target.value)} required
                placeholder="Código de 32 caracteres" maxLength={32} /></label>
            <label>Tu partido político
              <input aria-label="Partido invitado" value={joiningParty} maxLength={60}
                onChange={event => setJoiningParty(event.target.value)} required minLength={3}
                placeholder="Partido de la Reforma" /></label>
            <button disabled={pending} type="submit">Ocupar escaño</button>
          </form>
        </div>
        <PublicMatchPanel identity={user!.id} disabled={pending}
          onJoin={async (matchId, partyName) => {
            if (!user || pending) throw new Error('MATCH_BUSY')
            const owner = user.id
            setPending(true); setError(''); setNotice('')
            try {
              const id = await joinPublicLobby(matchId, partyName)
              if (ownerRef.current !== owner) return
              setActiveId(id)
              setNotice('Te has incorporado a una partida pública.')
              setReload(value => value + 1)
            } catch (reason) {
              if (ownerRef.current === owner) setError(matchError(reason))
              throw reason
            } finally {
              if (ownerRef.current === owner) setPending(false)
            }
          }} />
        <h3>Mis partidas</h3>
        <nav className="match-list" aria-label="Mis partidas">
          {matches.length ? matches.map(item => <button key={item.id}
            className={'match-list-item ' + (item.id === activeId ? 'selected' : '')}
            disabled={pending}
            onClick={() => setActiveId(item.id)}>
            <strong>{item.title}</strong><span>{item.party_name} · {item.player_count}/10 · {item.status}</span>
          </button>) : <p className="muted">No perteneces a ninguna partida todavía.</p>}
        </nav>
      </aside>

      <section className="match-main">
        {loading && !world ? <p role="status">Cargando nación compartida…</p>
        : !world ? <div className="match-empty"><p className="eyebrow">SIN PARTIDA SELECCIONADA</p>
          <h2>Convoca tu primera asamblea.</h2>
          <p className="muted">Crea una partida o usa un código de invitación. Cada cuenta representará un partido distinto.</p>
        </div> : <>
          <PlayerOnboarding world={world} />
          <div className="match-heading">
            <div><p className="eyebrow">PARTIDA {world.match.status === 'lobby' ? 'EN PREPARACIÓN' : 'ACTIVA'}</p>
              <h1>{world.match.title}</h1><p className="muted">Día de juego {world.gameDay} · {world.government.country_name}</p></div>
            <button className="text-button" onClick={() => setReload(value => value + 1)}
              disabled={pending}>Actualizar estado</button>
          </div>
          <div className="match-metrics">
            <div><span>TESORO PÚBLICO</span><strong>{number(world.government.treasury_m_eur)} M€</strong></div>
            <div><span>APROBACIÓN</span><strong>{world.government.approval}%</strong></div>
            <div><span>CONFIANZA</span><strong>{world.government.trust}%</strong></div>
            <div><span>PARTIDOS</span><strong>{world.players.length} / 10</strong></div>
          </div>
          <FiscalPanel key={world.government.id+':'+world.match.host_user_id}
            governmentId={world.government.id} compact />
          {world.match.status === 'active' && <LivingConditionsPanel
            governmentId={world.government.id} identity={user.id} />}
          <div className="match-invite">
            <div><span>INVITACIÓN A LA ASAMBLEA</span>
              <code>{world.match.invite_code}</code>
              <p>Comparte el código con cuentas autenticadas antes de comenzar.</p></div>
            <div className="lobby-invite-actions">
              <button className="text-button" onClick={() => void shareInvite()}>
                Copiar enlace de invitación
              </button>
              <button className="text-button" onClick={() => void navigator.clipboard?.writeText(world.match.invite_code)}>
                Copiar código
              </button>
            </div>
            {shareFailure && <p role="alert">{shareFailure}</p>}
          </div>
          {host && world.match.status==='lobby' && <div className="match-visibility">
            <div><strong>Visibilidad de la partida</strong>
              <p>{world.match.is_public
                ? 'Pública: cualquiera con cuenta podrá encontrar y solicitar una plaza.'
                : 'Privada: solo podrán entrar quienes conozcan el código.'}</p></div>
            <button type="button" className="text-button" disabled={pending}
              onClick={() => void mutate(
                () => setMatchVisibility(world.match.id, !world.match.is_public),
                world.match.is_public ? 'Partida retirada del tablón público.' :
                  'Partida publicada en el tablón para nuevos partidos.')}>
              {world.match.is_public ? 'Hacer privada' : 'Publicar partida'}
            </button>
          </div>}
          <ActionInboxPanel key={world.match.id} matchId={world.match.id}
            onNavigate={(section:InboxSection,dossierId:string|null)=>{
              if(dossierId){
                setSelectedDossierId(dossierId)
                setSelectedOptionId('')
                setReviewCabinet(false)
                setMandateOptionId(null)
              }
              if(section==='dossiers'||section==='parliament'){
                // The selected dossier is recomputed from the shared world.
                window.location.hash='match-dossiers'
              }
            }}/>
          <div className="match-seats" aria-label="Partidos de la asamblea">
            {Array.from({ length: 10 }, (_, i) => {
              const player = world.players.find(item => item.seat_no === i + 1)
              return <div className={'match-seat ' + (player ? 'occupied' : '')} key={i}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                <strong>{player?.party_name ?? 'Escaño disponible'}</strong>
                <small>{player ? (world.match.status==='lobby' ?
                  (player.is_ready ? 'PREPARADO' : 'PENDIENTE') :
                  (player.user_id === world.match.host_user_id ? 'GOBIERNO' : 'OPOSICIÓN') +
                  ' · ' + player.mandate_seats + ' escaños') : 'LIBRE'}</small>
              </div>
            })}
          </div>
          {world.match.status === 'active' && <>
            <MatchCalendarPanel matchId={world.match.id} />
            <div id="match-history"><WeeklyAccountabilityPanel matchId={world.match.id} /></div>
          </>}
          <div id="match-governance"><GovernancePanel matchId={world.match.id} userId={user!.id}
            active={world.match.status === 'active'} players={world.players}
            onGovernmentChanged={() => setReload(value => value + 1)} /></div>
          <PopulationPanel key={world.government.id + ':' + user!.id}
            governmentId={world.government.id} identity={user!.id} />
          <div id="match-campaign"><CampaignPanel key={world.match.id + ':' + user!.id}
            matchId={world.match.id} userId={user!.id}
            active={world.match.status === 'active'}
            onCampaignRecorded={() => setReload(value => value + 1)} /></div>
          <div id="match-election"><ElectionPanel matchId={world.match.id} userId={user!.id}
            active={world.match.status === 'active'}
            onElectionCertified={() => setReload(value => value + 1)} /></div>
          {world.match.status === 'lobby' ? <div className="match-waiting" id="match-lobby">
            <h2>Convocatoria abierta</h2>
            <p>La partida comienza con al menos dos partidos. Las plazas se bloquean
              cuando el anfitrión la activa.</p>
            <p role="status">{world.players.filter(p=>p.is_ready).length} de {world.players.length}
              {' '}partidos preparados.</p>
            <div className="lobby-ready-actions">
              <button type="button" disabled={pending} aria-pressed={world.me.is_ready}
                onClick={()=>void mutate(()=>setMatchReady(world.match.id,!world.me.is_ready),
                  world.me.is_ready?'Has retirado tu confirmación.':'Tu partido está preparado.')}>
                {world.me.is_ready?'Retirar preparación':'Confirmar que estoy preparado'}
              </button>
              {!host && <button type="button" className="text-button" disabled={pending}
                onClick={()=>void onLeaveLobby()}>
                Abandonar convocatoria
              </button>}
            </div>
            {host && <div className="lobby-readiness-config">
              <strong>Confirmación obligatoria antes de comenzar</strong>
              <p>{world.match.readiness_required?
                'Todos los partidos presentes deben confirmar su preparación.' :
                'Modo clásico: se permite comenzar con al menos dos partidos sin confirmación.'}</p>
              <button type="button" className="text-button" disabled={pending}
                onClick={()=>void mutate(()=>setMatchReadinessRequirement(
                  world.match.id,!world.match.readiness_required),
                  'Regla de preparación de la asamblea actualizada.')}>
                {world.match.readiness_required?'Desactivar confirmación':'Exigir confirmación'}
              </button>
            </div>}
            {host && <button disabled={pending || world.players.length < 2 ||
              (world.match.readiness_required && world.players.some(p=>!p.is_ready))}
              onClick={() => void mutate(() => startMatch(world.match.id),
                'La asamblea ha comenzado.')}>Comenzar legislatura</button>}
            {!host && <p role="status">Esperando la convocatoria del partido de gobierno.</p>}
          </div> : <div className="match-politics" id="match-dossiers">
            <WeeklyMissionControl key={world.match.id+':'+user!.id}
              world={world} userId={user!.id}
              onSelect={id => {
                setSelectedDossierId(id)
                setSelectedOptionId('')
                setReviewCabinet(false)
                setMandateOptionId(null)
              }} />
            <PolicyPortfolioPanel key={world.match.id + ':portfolio:' + user!.id}
              mode="parliament" dossiers={world.dossiers} options={world.options}
              events={world.events} gameDay={world.gameDay}
              treasury={world.government.treasury_m_eur}
              onSelect={item => {
                setSelectedDossierId(item.id)
                setSelectedOptionId('')
                setReviewCabinet(false)
                setMandateOptionId(null)
              }} />
            <MatchAgendaBoard key={world.match.id} world={world} userId={user!.id}
              selectedDossierId={dossier?.id ?? null}
              onSelect={id => {
                setSelectedDossierId(id)
                setSelectedOptionId('')
                setReviewCabinet(false)
                setMandateOptionId(null)
              }} />
            {dossier ? <div className="match-dossier">
              <p className="eyebrow">{dossier.category} · VERSIÓN {dossier.version}</p>
              <h3>{dossier.title}</h3><p>{dossier.context}</p>
              {dossier.source_url && <a href={dossier.source_url} target="_blank"
                rel="noopener noreferrer">Fuente: {dossier.source_title}</a>}
              <fieldset disabled={pending || (!!myStance && !host)}>
                <legend>ELIGE UNA POSICIÓN POLÍTICA</legend>
                {options.map(option => <label className="match-option" key={option.id}>
                  <input type="radio" name="match-option" value={option.id}
                    checked={selectedOptionId === option.id}
                    onChange={() => { setSelectedOptionId(option.id);setReviewCabinet(false) }} />
                  <span><strong>{option.title}</strong><small>{option.description}</small>
                    <em>Impacto fiscal: {number(option.treasury_delta_m_eur)} M€</em></span>
                </label>)}
              </fieldset>
              <ParliamentPanel key={world.match.id + ':' + dossier.id}
                matchId={world.match.id} dossierId={dossier.id}
                dossierVersion={dossier.version} options={options}
                selectedOptionId={selectedOptionId} userId={user!.id}
                players={world.players} host={host} decided={!!cabinetEvent}
                onMandateChange={setMandateOptionId} />
              {myStance ? <p className="match-recorded" role="status">
                Posición de tu partido registrada: {options.find(item => item.id === myStance.option_id)?.title}.
                Afinidad política calculada: {myStance.policy_affinity}/100.
              </p> : <button disabled={pending || !selectedOptionId}
                onClick={() => void onStance()}>Fijar posición del partido</button>}
              {host && <div className="match-cabinet">
                <p className="eyebrow">COMPETENCIA DEL GOBIERNO</p>
                {signatureUncertain && uncertainDossierId !== dossier?.id &&
                  <div role="status" className="fictitious-notice">
                    Tienes una firma por confirmar en otro expediente.
                    <button type="button" className="text-button" disabled={pending}
                      onClick={() => void reconcileCabinet()}>Sincronizar firma anterior</button>
                  </div>}
                {cabinetEvent ? <p role="status">Decisión ejecutada: {cabinetEvent.option_title_snapshot}.
                  Tesoro: {number(cabinetEvent.state_after.treasury_m_eur)} M€;
                  confianza: {cabinetEvent.state_after.trust}%.</p>
                : <>
                  <p>Solo el gobierno firma la decisión nacional, y únicamente después de que la asamblea apruebe esa opción. El mandato se verifica también en la base de datos.</p>
                  {signatureUncertain && <div className="fictitious-notice" role="status">
                    No se ha podido confirmar la firma de este expediente.
                    <button type="button" className="text-button" disabled={pending}
                      onClick={() => void reconcileCabinet()}>Sincronizar firma pendiente</button>
                  </div>}
                  {!mandateReady && !signatureUncertain &&
                    <p role="status">Selecciona la opción aprobada por el Parlamento para poder firmarla.</p>}
                  {!reviewCabinet ? <button disabled={pending || !mandateReady || signatureUncertain}
                    onClick={() => setReviewCabinet(true)}>Revisar decisión de gobierno</button>
                  : <div className="match-confirm">
                    <p>¿Ejecutar «{selectedOption?.title}» para toda la nación? Esta operación es irreversible.</p>
                    <button disabled={pending || !mandateReady || signatureUncertain}
                      onClick={() => void onCabinetDecision()}>Firmar y ejecutar</button>
                    <button className="text-button" disabled={pending}
                      onClick={() => setReviewCabinet(false)}>Cancelar</button>
                  </div>}
                </>}
              </div>}
            </div> : <p className="muted">No hay expedientes disponibles hoy.</p>}
            <div className="match-feed">
              <h3>Actividad de la asamblea</h3>
              {world.stances.length === 0 && world.events.length === 0 && <p className="muted">Todavía no hay posiciones ni decisiones firmadas.</p>}
              {world.stances.map(stance => <div key={stance.user_id+stance.dossier_id}>
                <span>PARTIDO</span><strong>{world.players.find(p => p.user_id === stance.user_id)?.party_name}</strong>
                <p>{world.dossiers.find(d => d.id === stance.dossier_id)?.title ?? stance.dossier_id} ·
                  {world.options.find(o => o.dossier_id === stance.dossier_id && o.id === stance.option_id)?.title ?? stance.option_id} ·
                  afinidad {stance.policy_affinity}/100</p>
              </div>)}
              {world.events.map(event => <div key={event.id}>
                <span>GOBIERNO</span><strong>{event.dossier_title_snapshot}</strong>
                <p>{event.option_title_snapshot} · tesoro {number(event.state_after.treasury_m_eur)} M€
                  · confianza {event.state_after.trust}%</p>
              </div>)}
            </div>
          </div>}
          <DecisionAnalyticsPanel key={world.government.id + ':' + world.match.id}
            events={world.events} gameDay={world.gameDay}
            countryName={world.government.country_name} />
        </>}
        {notice && <p className="editorial-success" role="status">{notice}</p>}
        {error && <p className="editorial-alert" role="alert">{error}</p>}
      </section>
    </main>}
    <footer className="footer"><span>ACT OF STATE · EVERY DECISION SHAPES A NATION</span>
      <span>10 PARTY CAP · AUTHORITATIVE SHARED STATE</span></footer>
  </div>
}
