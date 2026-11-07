import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import AuthGateway from './AuthGateway'
import AccountSecurity from './AccountSecurity'
import { client, fetchWorld, friendlyError, startGovernment, submitDecision } from './lib/game'
import type { GovernmentWorld } from './lib/types'
import { number, signed } from './lib/format'
import {
  INTRO_CASES, ALL_SOLO_CASES, ELECTION_CHECKPOINTS, chooseGuest, clearGuest, committedMandate,
  consequences, electionResult, emptyGuest, evaluateGuest, importGuest,
  loadGuest, saveGuest, type GuestProgress, type SimpleChoice,
  type SimpleMetrics
} from './lib/simpleGame'
import './simple-game.css'

type Screen = 'play' | 'result' | 'election' | 'history' | 'access' | 'menu'
interface LastResult {
  caseId: string
  optionId: string
  before: SimpleMetrics
  after: SimpleMetrics
  isGuest: boolean
}
const sameOwner = (world: GovernmentWorld, id: string) => world.government.owner_id === id
const metrics = (values: SimpleMetrics) => [
  { label: 'Popularidad', value: values.approval + '%', icon: '♥' },
  { label: 'Tesoro público', value: number(values.treasury_m_eur) + ' M€', icon: '€' },
  { label: 'Confianza', value: values.trust + '%', icon: '◆' }
]

/**
 * One current dilemma, one decision, one immediate verified result.
 * The server remains authoritative for logged-in decisions. Guest play uses
 * validated local previews that are explicitly imported on user request.
 */
export default function SimpleSoloApp() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [storedWorld, setWorld] = useState<GovernmentWorld | null>(null)
  const ownerRef = useRef<string | null>(null)
  const [reload, setReload] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [needsSync, setNeedsSync] = useState(false)
  const [guest, setGuest] = useState<GuestProgress>(loadGuest)
  const [skipImport, setSkipImport] = useState(false)
  const [screen, setScreen] = useState<Screen>('play')
  const [acknowledgedCheckpoint, setAcknowledgedCheckpoint] = useState(0)
  const [selected, setSelected] = useState('')
  const [result, setResult] = useState<LastResult | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    if (!client) { setAuthReady(true); return }
    let alive = true
    let revision = 0
    const initialRevision = revision
    function accept(next: User | null) {
      const id = next?.id ?? null
      if (ownerRef.current !== id) {
        ownerRef.current = id
        setWorld(null)
        setSelected('')
        setResult(null)
        setSkipImport(false)
        setNeedsSync(false)
        setAcknowledgedCheckpoint(0)
        setScreen('play')
      }
      setUser(next)
      setAuthReady(true)
    }
    client.auth.getUser().then(({ data, error: authError }) => {
      if (alive && revision === initialRevision) accept(authError ? null : data.user)
    }).catch(() => { if (alive) setAuthReady(true) })
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      if (event !== 'INITIAL_SESSION') revision++
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      accept(session?.user ?? null)
    })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!user) { setWorld(null); setLoading(false); return }
    const owner = user.id
    let alive = true
    setWorld(null)
    setLoading(true)
    setError('')
    async function boot() {
      try {
        const government = await startGovernment()
        if (government.owner_id !== owner) throw new Error('El gobierno no corresponde a tu cuenta.')
        const world = await fetchWorld(government.id)
        if (!sameOwner(world, owner)) throw new Error('El país no corresponde a tu cuenta.')
        if (alive && ownerRef.current === owner) {
          setWorld(world)
          setNeedsSync(false)
        }
      } catch (reason) {
        if (alive && ownerRef.current === owner) setError(friendlyError(reason))
      } finally {
        if (alive && ownerRef.current === owner) setLoading(false)
      }
    }
    void boot()
    return () => { alive = false }
  }, [user?.id, reload])

  const world = user && storedWorld && sameOwner(storedWorld, user.id) ? storedWorld : null
  const guestSnapshot = evaluateGuest(guest)
  const mandate = world ? committedMandate(world) : null
  const completed = world ? (mandate?.completed ?? 0) : guest.decisions.length
  const index = world ? (mandate?.nextIndex ?? 0) : guest.decisions.length
  // Checkpoints are acknowledgement screens; later reforms do not require a new account.
  const stageStart = user
    ? completed >= 24 && (completed > 24 || acknowledgedCheckpoint >= 24) ? 24
      : completed >= 12 && (completed > 12 || acknowledgedCheckpoint >= 12) ? 12 : 0
    : 0
  const checkpoint = ELECTION_CHECKPOINTS[stageStart === 0 ? 0 : stageStart === 12 ? 1 : 2]
  const stageTotal = checkpoint - stageStart
  const stageProgress = Math.max(0, Math.min(stageTotal, completed - stageStart))
  const reachedElection = completed >= checkpoint
  const scenario = (user ? ALL_SOLO_CASES : INTRO_CASES)[index] ?? null
  const realDossier = scenario && world
    ? world.dossiers.find(d => d.id === scenario.id && d.version === scenario.version) : null
  const availableChoices: SimpleChoice[] = scenario && world
    ? world.options.filter(o => o.dossier_id === scenario.id &&
        o.dossier_version === scenario.version).map(o => ({
        id: o.id, title: o.title, description: o.description,
        treasuryDelta: o.treasury_delta_m_eur, policyTarget: o.policy_target,
        responseIntensity: o.response_intensity, trustBaseDelta: o.trust_base_delta
      }))
    : scenario?.options.slice() ?? []
  const currentChoice = availableChoices.find(choice => choice.id === selected)
  const currentMetrics: SimpleMetrics = world
    ? { treasury_m_eur: world.government.treasury_m_eur,
        approval: world.government.approval, trust: world.government.trust }
    : guestSnapshot.metrics
  const needsImport = Boolean(user && world && guest.decisions.length > 0 && !skipImport)
  const electionState = world && mandate
    ? mandate.signed[checkpoint - 1]?.state_after ?? mandate.finalState
    : guestSnapshot.metrics
  const shownScreen: Screen = screen === 'play' && reachedElection ? 'election' : screen

  function changeScreen(next: Screen) {
    setScreen(next)
    setError('')
    window.scrollTo(0, 0)
  }

  async function takeDecision() {
    if (!scenario || !currentChoice || pending || needsSync) return
    setError('')
    setNotice('')
    if (!user) {
      try {
        const updated = chooseGuest(guest, scenario.id, currentChoice.id)
        const nextSnapshot = evaluateGuest(updated)
        const previous = guestSnapshot.metrics
        const after = nextSnapshot.metrics
        if (!saveGuest(updated))
          setNotice('La decisión se conserva en esta sesión, pero tu navegador no permite guardarla para una visita posterior.')
        setGuest(updated)
        setSelected('')
        setResult({ caseId: scenario.id, optionId: currentChoice.id,
          before: previous, after, isGuest: true })
        changeScreen('result')
      } catch (reason) {
        setError(friendlyError(reason))
      }
      return
    }
    if (!world || !realDossier || !world.options.some(o =>
      o.id === currentChoice.id && o.dossier_id === scenario.id &&
      o.dossier_version === scenario.version)) {
      setError('Este expediente todavía no está disponible en el servidor. No se ha registrado ninguna decisión.')
      return
    }
    const owner = user.id
    setPending(true)
    let submissionError: unknown
    try {
      try {
        await submitDecision(world.government.id, scenario.id, scenario.version, currentChoice.id)
      } catch (reason) {
        submissionError = reason
      }
      const fresh = await fetchWorld(world.government.id)
      if (ownerRef.current !== owner || !sameOwner(fresh, owner)) return
      setWorld(fresh)
      const verified = fresh.events.find(e => e.dossier_id === scenario.id)
      if (!verified) {
        setNeedsSync(true)
        throw new Error(submissionError
          ? friendlyError(submissionError) + ' El servidor no ha confirmado el resultado. Sincroniza antes de reintentar.'
          : 'No se ha confirmado la decisión. Sincroniza antes de continuar.')
      }
      if (verified.option_id !== currentChoice.id) {
        setNeedsSync(true)
        throw new Error('Este expediente ya estaba firmado con otra opción.')
      }
      setNeedsSync(false)
      setSelected('')
      setResult({
        caseId: scenario.id, optionId: verified.option_id,
        before: verified.state_before, after: verified.state_after, isGuest: false
      })
      changeScreen('result')
    } catch (reason) {
      if (ownerRef.current === owner) {
        setNeedsSync(true)
        setError(friendlyError(reason))
      }
    } finally { setPending(false) }
  }

  async function importDecisions() {
    if (!user || !world || pending || guest.decisions.length === 0) return
    const owner = user.id
    const governmentId = world.government.id
    setPending(true)
    setError('')
    setNotice('')
    try {
      const imported = await importGuest(guest, {
        load: async () => {
          const data = await fetchWorld(governmentId)
          if (!sameOwner(data, owner) || ownerRef.current !== owner)
            throw new Error('Tu sesión ha cambiado. Importación detenida.')
          return data
        },
        sign: async (dossier, optionId) => {
          if (ownerRef.current !== owner) throw new Error('Tu sesión ha cambiado.')
          return submitDecision(governmentId, dossier.id, dossier.version, optionId)
        }
      })
      if (ownerRef.current !== owner) return
      setWorld(imported.world)
      if (clearGuest()) {
        setGuest(emptyGuest())
        setSkipImport(false)
      } else {
        setSkipImport(true)
        setNotice('Las decisiones se han registrado en el servidor. No se pudo borrar la copia local; puedes eliminarla desde este navegador.')
      }
      setNotice('Partida guardada. ' + imported.imported +
        ' decisiones nuevas verificadas por el servidor.')
      setSelected('')
      setResult(null)
      changeScreen('play')
    } catch (reason) {
      if (ownerRef.current === owner)
        setError('No se ha completado la importación: ' + friendlyError(reason) +
          ' Las decisiones de invitado permanecen guardadas; puedes reintentar.')
    } finally { setPending(false) }
  }

  async function signOut() {
    if (!client || pending) return
    setPending(true)
    try {
      const { error: authError } = await client.auth.signOut()
      if (authError) throw authError
      ownerRef.current = null
      setUser(null)
      setWorld(null)
      setResult(null)
      setScreen('play')
    } catch (reason) { setError(friendlyError(reason)) }
    finally { setPending(false) }
  }

  function resetGuest() {
    if (user || pending) return
    if (!clearGuest()) {
      setError('El navegador no permite borrar el progreso guardado.')
      return
    }
    setGuest(emptyGuest())
    setSelected('')
    setResult(null)
    setConfirmReset(false)
    setNotice('')
    changeScreen('play')
  }

  const resultCase = result ? ALL_SOLO_CASES.find(item => item.id === result.caseId) : null
  const resultChoice = resultCase?.options.find(item => item.id === result?.optionId)
  const story = resultCase && resultChoice && result
    ? consequences(resultCase, resultChoice, result.before, result.after) : null
  const delta = result
    ? [
      { label: 'Popularidad', value: result.after.approval - result.before.approval, unit: ' pt' },
      { label: 'Tesoro', value: result.after.treasury_m_eur - result.before.treasury_m_eur, unit: ' M€' },
      { label: 'Confianza', value: result.after.trust - result.before.trust, unit: ' pt' }
    ] : []

  return <div className="simple-root">
    <header className="simple-header">
      <button type="button" className="simple-brand" onClick={() => changeScreen('play')}
        aria-label="Ir a mi gobierno">
        <span className="simple-brand-mark">A/S</span>
        <span>ACT OF STATE</span>
      </button>
      <span className="simple-header-mode">Gobierna. Decide. Asume las consecuencias.</span>
      <button className="simple-menu-button" type="button"
        onClick={() => changeScreen(screen === 'menu' ? 'play' : 'menu')} aria-label="Abrir menú">
        Menú
      </button>
    </header>
    {!authReady ? <main className="simple-card" role="status">Comprobando tu partida…</main> : <>
      {user && recovering && <AccountSecurity recovering onRecovered={() => setRecovering(false)} />}
      {user && (loading || !world) ? <main className="simple-card" role="status">
        <h1>{loading ? 'Recuperando tu país…' : 'No se pudo recuperar el Gobierno'}</h1>
        {error && <p role="alert">{error}</p>}
        <button className="simple-primary" type="button" onClick={() => setReload(x => x + 1)}>
          Reintentar
        </button>
      </main> : <>
        {needsImport ? <main className="simple-card simple-import">
          <div className="simple-kicker">CONTINUAR PARTIDA</div>
          <h1>Ya tienes {guest.decisions.length} decisiones de invitado.</h1>
          <p>¿Quieres incorporarlas a este Gobierno? Se confirmarán una a una en el servidor. Si alguna ya está firmada con otra opción, nos detendremos sin sobrescribirla.</p>
          <button className="simple-primary" type="button" disabled={pending} onClick={() => void importDecisions()}>
            {pending ? 'Verificando decisiones…' : 'Guardar mi progreso en la cuenta'}
          </button>
          <button className="simple-secondary" type="button" disabled={pending}
            onClick={() => { setSkipImport(true); setError(''); setNotice('') }}>
            Continuar con mi gobierno actual
          </button>
          {error && <p role="alert" className="simple-error">{error}</p>}
        </main> : <main className="simple-main">
          {shownScreen === 'play' && <>
            <div className="simple-topline">
              <span>{user ? 'TU GOBIERNO · PARTIDA GUARDADA' : 'JUGAR SIN REGISTRARTE · PROGRESO LOCAL'}</span>
              {user ? <span>República de Arcadia</span> :
                <button className="simple-link" type="button" onClick={() => changeScreen('access')}>Guardar mi partida</button>}
            </div>
            <div className="simple-metrics" aria-label="Estado de tu país">
              {metrics(currentMetrics).map(m => <div className="simple-metric" key={m.label}>
                <span aria-hidden="true">{m.icon}</span>
                <strong>{m.value}</strong><small>{m.label}</small>
              </div>)}
            </div>
            {scenario ? <article className="simple-card simple-dilemma" data-testid="simple-dilemma">
              <div className="simple-progress-line">
                <span>DECISIÓN {stageProgress + 1} DE {stageTotal}</span>
                <span>OBJETIVO: GANAR LAS ELECCIONES</span>
              </div>
              <div className="simple-progress" role="progressbar" aria-label="Progreso del mandato"
                aria-valuenow={stageProgress} aria-valuemin={0} aria-valuemax={stageTotal}>
                <span style={{ width: (stageProgress / stageTotal * 100) + '%' }} />
              </div>
              <p className="simple-category">{scenario.category}</p>
              <h1>{realDossier?.title ?? scenario.title}</h1>
              <p className="simple-context">{(realDossier?.context ?? scenario.context)
                .replace(/^(Un escenario ficticio|Escenario ficticio):\s*/i, '')}</p>
              <fieldset className="simple-choices" disabled={pending || needsSync}>
                <legend>¿Qué decides?</legend>
                {availableChoices.map(choice => <button type="button" key={choice.id}
                  className={'simple-choice' + (selected === choice.id ? ' is-selected' : '')}
                  aria-pressed={selected === choice.id} disabled={pending || needsSync}
                  onClick={() => { setSelected(choice.id); setError('') }}>
                  <strong>{choice.title}</strong>
                  <small>{choice.description}</small>
                  <span className="simple-cost">
                    {choice.treasuryDelta < 0 ? 'Coste ' + number(-choice.treasuryDelta) + ' M€' :
                      choice.treasuryDelta > 0 ? 'Ahorro ' + number(choice.treasuryDelta) + ' M€' :
                      'Sin coste inmediato'}
                  </span>
                </button>)}
              </fieldset>
              <button type="button" className="simple-primary" disabled={!currentChoice || pending || needsSync}
                onClick={() => void takeDecision()}>
                {pending ? 'Confirmando decisión…' : 'Tomar esta decisión'}
              </button>
              <p className="simple-footnote">Las decisiones son definitivas.
                {!user && ' Estás probando una simulación local; al guardar, el servidor recalculará sus efectos reales.'}
              </p>
              {needsSync && <button type="button" className="simple-secondary" onClick={() => setReload(x => x + 1)}>Sincronizar resultado pendiente</button>}
            </article> : <section className="simple-card">
              <h1>No hay más decisiones de este mandato.</h1>
              <p>El servidor aún no ofrece el siguiente expediente. Tus decisiones guardadas están intactas. Puedes consultar el modo avanzado o reintentar cuando se publique el contenido.</p>
              <a className="simple-primary simple-action-link" href="/advanced">Abrir mi gobierno avanzado</a>
            </section>}
          </>}
          {shownScreen === 'result' && story && result && <>
            <div className="simple-kicker">RESULTADO · {result.isGuest ? 'ESTIMACIÓN DE INVITADO' : 'DECISIÓN CONFIRMADA EN EL SERVIDOR'}</div>
            <article className="simple-card simple-result" data-testid="simple-outcome">
              <div className="simple-result-symbol" aria-hidden="true">✓</div>
              <h1>{story.title}</h1>
              <p className="simple-context">{story.body}</p>
              <div className="simple-changes">
                {delta.map(item => <div key={item.label}>
                  <span>{item.label}</span>
                  <strong className={item.value > 0 ? 'simple-positive' : item.value < 0 ? 'simple-negative' : ''}>
                    {signed(item.value)}{item.unit}
                  </strong>
                </div>)}
              </div>
              {story.warning && <p className="simple-warning">{story.warning}</p>}
              {result.isGuest && <p className="simple-footnote">Valores orientativos. Al guardarlos en tu cuenta se ejecutará el motor oficial.</p>}
              <button type="button" className="simple-primary" onClick={() => changeScreen('play')}>
                {reachedElection ? 'Ver las elecciones' : 'Siguiente decisión'}
              </button>
            </article>
          </>}
          {shownScreen === 'election' && <>
            <div className="simple-kicker">FINAL DEL MANDATO {Math.floor(stageStart / 12) + 1} · {stageTotal} DECISIONES</div>
            <article className="simple-card simple-election" data-testid="simple-election">
              <div className="simple-election-icon" aria-hidden="true">★</div>
              <h1>{electionResult(electionState).headline}</h1>
              <div className="simple-election-vote">{electionResult(electionState).estimatedVote}%</div>
              <p>Voto estimado a partir de la popularidad, la confianza y las reservas públicas al terminar el mandato.</p>
              <p className="simple-footnote">Resultado ficticio del modo individual, no elección parlamentaria certificada. El objetivo era alcanzar el 50% de apoyo estimado.</p>
              {user && checkpoint < ALL_SOLO_CASES.length ?
                <button type="button" className="simple-primary" onClick={() => {
                  setAcknowledgedCheckpoint(checkpoint)
                  changeScreen('play')
                }}>Continuar con el siguiente mandato</button> :
              user ? <a href="/advanced" className="simple-primary simple-action-link">Ver todas mis estadísticas y campañas</a> :
                <button type="button" className="simple-primary" onClick={() => changeScreen('access')}>Guardar mi mandato y continuar</button>}
              <button type="button" className="simple-secondary" onClick={() => changeScreen('history')}>Ver mis decisiones</button>
            </article>
          </>}
          {shownScreen === 'history' && <section className="simple-card simple-history">
            <div className="simple-kicker">TUS DECISIONES</div>
            <h1>Así has gobernado</h1>
            <div className="simple-history-list">
              {(user ? ALL_SOLO_CASES : INTRO_CASES).map((item, i) => {
                const event = world ? mandate?.signed[i] : guestSnapshot.events.find(e => e.caseId === item.id)
                if (!event) return null
                const optionId = 'option_id' in event ? event.option_id : event.optionId
                return <div key={item.id}>
                  <span>{i + 1}. {item.category}</span>
                  <strong>{item.title}</strong>
                  <small>{item.options.find(c => c.id === optionId)?.title ?? 'Decisión registrada'}</small>
                </div>
              })}
              {completed === 0 && <p>Aún no has tomado ninguna decisión.</p>}
            </div>
            <button type="button" className="simple-primary" onClick={() => changeScreen('play')}>Volver a gobernar</button>
          </section>}
          {shownScreen === 'access' && <section className="simple-card simple-access">
            <div className="simple-kicker">GUARDAR TU PARTIDA</div>
            <h1>Continúa cuando quieras</h1>
            {user ? <>
              <p>Ya has iniciado sesión. Las decisiones firmadas están guardadas en el servidor.</p>
              <button className="simple-primary" onClick={() => changeScreen('play')} type="button">Volver a la partida</button>
            </> : client ? <>
              <p>Crea una cuenta o entra con tu contraseña. Tus decisiones de invitado no se borrarán al iniciar sesión. Después podrás importarlas expresamente.</p>
              <AuthGateway redirectTo={window.location.origin} />
              <button className="simple-secondary" onClick={() => changeScreen('play')} type="button">Seguir como invitado</button>
            </> : <>
              <p>La conexión para guardar partidas en una cuenta no está disponible. Puedes seguir jugando en este navegador.</p>
              <button className="simple-primary" onClick={() => changeScreen('play')} type="button">Volver a jugar</button>
            </>}
          </section>}
          {shownScreen === 'menu' && <section className="simple-card simple-menu">
            <h1>Menú</h1>
            <button className="simple-secondary" type="button" onClick={() => changeScreen('play')}>Volver a jugar</button>
            <button className="simple-secondary" type="button" onClick={() => changeScreen('history')}>Historial de decisiones</button>
            {!user && <button className="simple-secondary" type="button" onClick={() => changeScreen('access')}>Guardar partida / Iniciar sesión</button>}
            {user && !recovering && <AccountSecurity onRecovered={() => setRecovering(false)} />}
            {user && guest.decisions.length > 0 && <button className="simple-secondary" type="button" onClick={() => { setSkipImport(false); changeScreen('play') }}>Importar decisiones de invitado</button>}
            <a href="/multiplayer" className="simple-secondary simple-action-link">Partida parlamentaria · multijugador</a>
            <a href="/advanced" className="simple-secondary simple-action-link">Modo avanzado · presupuesto, estadísticas y reformas</a>
            <a href="/guide" className="simple-secondary simple-action-link">Reglas del juego</a>
            {user ? <button className="simple-secondary" type="button" disabled={pending} onClick={() => void signOut()}>Cerrar sesión</button>
              : guest.decisions.length > 0 && <>
                {!confirmReset ? <button className="simple-danger-link" type="button" onClick={() => setConfirmReset(true)}>Reiniciar partida de invitado</button> :
                  <div className="simple-reset">
                    <p>¿Borrar las decisiones guardadas en este navegador?</p>
                    <button className="simple-danger-link" type="button" onClick={resetGuest}>Sí, borrar partida</button>
                    <button className="simple-secondary" type="button" onClick={() => setConfirmReset(false)}>Cancelar</button>
                  </div>}
              </>}
          </section>}
          {error && <p className="simple-error" role="alert">{error}</p>}
          {notice && <p className="simple-notice" role="status">{notice}</p>}
        </main>}
      </>}
    </>}
    <nav className="simple-bottom-nav" aria-label="Navegación principal">
      <button type="button" className={shownScreen === 'play' || shownScreen === 'result' || shownScreen === 'election' ? 'active' : ''}
        onClick={() => changeScreen('play')}><span aria-hidden="true">⌂</span>Mi gobierno</button>
      <button type="button" className={shownScreen === 'history' ? 'active' : ''}
        onClick={() => changeScreen('history')}><span aria-hidden="true">▤</span>Historia</button>
      <button type="button" className={shownScreen === 'menu' ? 'active' : ''}
        onClick={() => changeScreen('menu')}><span aria-hidden="true">☰</span>Menú</button>
    </nav>
  </div>
}