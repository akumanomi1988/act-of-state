import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { client, fetchWorld, friendlyError, startGovernment, submitDecision } from './lib/game'
import { number } from './lib/format'
import type { Dossier, DossierOption, GovernmentWorld } from './lib/types'
import Outcome from './components/Outcome'
import FiscalPanel from './FiscalPanel'
import DecisionAnalyticsPanel from './DecisionAnalyticsPanel'
import PopulationPanel from './PopulationPanel'
import LivingConditionsPanel from './LivingConditionsPanel'

function dossierKey(d: Dossier): string {
  return d.id + ':' + d.version
}

function available(d: Dossier, day: string): boolean {
  return (!d.available_from || day >= d.available_from) &&
    (!d.available_until || day <= d.available_until)
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [mailSent, setMailSent] = useState(false)
  const [storedWorld, setWorld] = useState<GovernmentWorld | null>(null)
  const [bootRevision, setBootRevision] = useState(0)
  const authenticatedOwnerRef = useRef<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [optionId, setOptionId] = useState('')
  const [reviewingDecision, setReviewingDecision] = useState(false)
  const [pending, setPending] = useState(false)
  const [needsReconciliation, setNeedsReconciliation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // A previous account's in-memory world must never be rendered for a new user.
  const world = user && storedWorld?.government.owner_id === user.id ? storedWorld : null

  function acceptUser(nextUser: User | null) {
    authenticatedOwnerRef.current = nextUser?.id ?? null
    setUser(nextUser)
  }

  useEffect(() => {
    if (!client) { setAuthReady(true); return }
    let alive = true
    let authRevision = 0
    const initialRevision = authRevision
    client.auth.getUser().then(({ data, error: authError }) => {
      // A slower getUser response cannot undo a newer sign-in or account switch.
      if (!alive || authRevision !== initialRevision) return
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
    if (!user) { setWorld(null); setLoading(false); return }
    const ownerId = user.id
    let active = true
    setWorld(null)
    setSelectedKey(null)
    setSelectedEventId(null)
    setOptionId('')
    setReviewingDecision(false)
    setNeedsReconciliation(false)
    setLoading(true)
    setError('')
    const boot = async () => {
      try {
        const government = await startGovernment()
        if (government.owner_id !== ownerId) throw new Error('El gobierno no pertenece a la sesión actual.')
        const data = await fetchWorld(government.id)
        if (data.government.owner_id !== ownerId) throw new Error('El estado nacional no pertenece a la sesión actual.')
        if (active && authenticatedOwnerRef.current === ownerId) setWorld(data)
      } catch (reason) {
        if (active && authenticatedOwnerRef.current === ownerId) setError(friendlyError(reason))
      } finally {
        if (active && authenticatedOwnerRef.current === ownerId) setLoading(false)
      }
    }
    void boot()
    return () => { active = false }
  }, [user?.id, bootRevision])

  const dossier = useMemo(() => {
    if (!world) return null
    return world.dossiers.find(d => dossierKey(d) === selectedKey) ??
      world.dossiers[0] ?? null
  }, [world, selectedKey])

  const options = useMemo(() => (world && dossier
    ? world.options.filter(o => o.dossier_id === dossier.id && o.dossier_version === dossier.version)
    : []), [world, dossier])

  const selectedOption = options.find(option => option.id === optionId) ?? null

  const decision = useMemo(() => world?.events.find(e =>
    e.dossier_id === dossier?.id) ?? null, [world, dossier])
  const historicalEvent = useMemo(() => world?.events.find(e =>
    e.id === selectedEventId) ?? null, [world, selectedEventId])

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) return
    setPending(true)
    setError('')
    try {
      const { error: authError } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin }
      })
      if (authError) setError(friendlyError(authError))
      else setMailSent(true)
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setPending(false)
    }
  }

  async function onDecision() {
    if (!world || !dossier || !selectedOption || !reviewingDecision || !user || pending || decision || needsReconciliation) return
    const ownerId = user.id
    setPending(true)
    setError('')

    // The RPC may commit even if its HTTP response is lost. Reconcile against
    // the authoritative event history before reporting a failed decision.
    let submissionError: unknown = null
    try {
      await submitDecision(world.government.id, dossier.id, dossier.version, optionId)
    } catch (reason) {
      submissionError = reason
    }

    try {
      const persisted = await fetchWorld(world.government.id)
      if (authenticatedOwnerRef.current !== ownerId) return
      if (persisted.government.owner_id !== ownerId) throw new Error('El estado nacional no pertenece a la sesión actual.')
      setWorld(persisted)
      const recorded = persisted.events.find(event => event.dossier_id === dossier.id)
      if (recorded) {
        setOptionId('')
        setReviewingDecision(false)
        setNeedsReconciliation(false)
        if (recorded.option_id !== optionId || recorded.dossier_version !== dossier.version) {
          setError('Este expediente ya se resolvió con otra opción.')
        }
      } else if (submissionError) {
        // A transport failure may outlive this read. Require an explicit
        // fresh snapshot before allowing a second signature.
        setNeedsReconciliation(true)
        setError(friendlyError(submissionError) + ' Sincroniza antes de volver a firmar.')
      } else {
        setNeedsReconciliation(true)
        setError('La decisión fue recibida, pero no aparece en el estado nacional. Sincroniza antes de continuar.')
      }
    } catch {
      if (authenticatedOwnerRef.current === ownerId) {
        setNeedsReconciliation(true)
        setError('No se pudo verificar si la decisión quedó registrada. Sincroniza antes de continuar.')
      }
    } finally {
      setPending(false)
    }
  }

  async function reconcileWorld() {
    if (!world || !user || pending) return
    const ownerId = user.id
    setPending(true)
    setError('')
    try {
      const persisted = await fetchWorld(world.government.id)
      if (authenticatedOwnerRef.current !== ownerId) return
      if (persisted.government.owner_id !== ownerId) throw new Error('El estado nacional no pertenece a la sesión actual.')
      setWorld(persisted)
      setOptionId('')
      setReviewingDecision(false)
      setNeedsReconciliation(false)
    } catch (reason) {
      if (authenticatedOwnerRef.current === ownerId) {
        setNeedsReconciliation(true)
        setError('No se ha podido actualizar el estado nacional: ' + friendlyError(reason))
      }
    } finally {
      setPending(false)
    }
  }

  async function signOut() {
    if (!client) return
    setPending(true)
    try {
      const { error: signOutError } = await client.auth.signOut()
      if (signOutError) setError(friendlyError(signOutError))
      else { acceptUser(null); setWorld(null); setMailSent(false); setReviewingDecision(false); setNeedsReconciliation(false) }
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setPending(false)
    }
  }

  function selectDossier(d: Dossier) {
    setSelectedKey(dossierKey(d))
    setSelectedEventId(null)
    setOptionId('')
    setReviewingDecision(false)
    setError('')
  }

  function selectHistory(eventId: string) {
    setSelectedEventId(eventId)
    setReviewingDecision(false)
    setError('')
  }

  const weekDay = world?.gameDay
    ? new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
      .format(new Date(world.gameDay + 'T12:00:00Z'))
    : ''

  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand-group">
          <span className="brand-symbol" aria-hidden="true">A<span>／</span>S</span>
          <div><div className="wordmark">ACT OF STATE</div><div className="brand-caption">EVERY DECISION SHAPES A NATION.</div></div>
        </div>
        <div className="header-end"><span className="online-dot" aria-hidden="true" /> SIMULACIÓN POLÍTICA PERSISTENTE
          <a href="/multiplayer" className="text-button">Multijugador</a>
          {user && <button type="button" className="text-button" onClick={() => void signOut()} disabled={pending}>Cerrar sesión</button>}
        </div>
      </header>

      {!client ? (
        <main className="entry-content"><div className="eyebrow">CONFIGURACIÓN REQUERIDA</div>
          <h1>La nación aún no está conectada.</h1>
          <p>Configura una instancia exclusiva de Supabase con las variables de <code>.env.example</code> y aplica la migración antes de comenzar. No se muestran estadísticas ficticias.</p>
        </main>
      ) : !authReady ? (
        <main className="entry-content" role="status">Verificando credenciales…</main>
      ) : !user ? (
        <main className="entry-layout">
          <section className="hero-intro"><div className="eyebrow">EL PESO DEL PODER · INICIO</div>
            <h1>Gobernar es elegir qué consecuencias asumir.</h1>
            <p>Una simulación política seria, persistente y gratuita. Las decisiones modifican la economía, la confianza institucional y el apoyo de grupos de población simulados.</p>
            <p className="caveat">Escenarios editoriales ficticios para la primera iteración.</p>
          </section>
          <section className="login-panel" aria-labelledby="access-title">
            <div className="eyebrow">ACCESO A LA SALA DE GOBIERNO</div>
            <h2 id="access-title">Tu mandato comienza aquí.</h2>
            <p>Recibirás un enlace de acceso seguro por correo electrónico.</p>
            <form onSubmit={event => void onLogin(event)}>
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" type="email" autoComplete="email" required value={email}
                onChange={event => setEmail(event.target.value)} placeholder="tu@correo.es" />
              <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Enviando…' : 'Enviar enlace de acceso'}</button>
            </form>
            {mailSent && <p className="success" role="status">Comprueba tu correo. Se ha solicitado el enlace de acceso.</p>}
          </section>
        </main>
      ) : loading || !world ? (
        <main className="entry-content">
          {loading ? <p role="status">Abriendo la sesión de gobierno…</p> : <>
            <p>No se ha podido recuperar la sesión de gobierno.</p>
            <button type="button" className="primary-button" onClick={() => setBootRevision(revision => revision + 1)}>
              Reintentar acceso al gobierno
            </button>
          </>}
        </main>
      ) : (
        <>
          <div className="session-strip"><span>DESPACHO DEL GOBIERNO</span><span>{world.government.country_name}</span><span>DÍA DE JUEGO · {weekDay}</span></div>
          <FiscalPanel key={world.government.id} governmentId={world.government.id} />
          <main className="government-layout">
            <aside className="side-panel">
              <div className="eyebrow">01 / DESPACHO</div>
              <h1>La agenda de gobierno</h1>
              <p className="muted">Cada decisión queda registrada y altera el rumbo del país.</p>
              <div className="day-card">
                <span>CALENDARIO INSTITUCIONAL</span>
                <strong>{world.gameDay}</strong>
                <small>Un día real equivale a un día de juego. Hora de referencia: UTC.</small>
              </div>
              <section className="weekly-card" aria-label="Ciclo político semanal">
                <div className="eyebrow">SEMANA POLÍTICA · RELOJ DEL SERVIDOR</div>
                <div className="week-dates">
                  <div><span>LUNES · PUBLICACIÓN</span><strong>{world.calendar.weekStart}</strong></div>
                  <div><span>VIERNES · HITO</span><strong>{world.calendar.friday}</strong></div>
                </div>
                <div className="week-progress-label">
                  <span>Expedientes semanales resueltos</span>
                  <strong>{world.calendar.weeklyResolved} / {world.calendar.weeklyTotal}</strong>
                </div>
                {world.calendar.weeklyTotal > 0 ? (
                  <div className="week-progress" role="progressbar" aria-label="Expedientes semanales resueltos"
                    aria-valuemin={0} aria-valuemax={world.calendar.weeklyTotal}
                    aria-valuenow={world.calendar.weeklyResolved}>
                    <span style={{ width: (100 * world.calendar.weeklyResolved / world.calendar.weeklyTotal) + '%' }} />
                  </div>
                ) : <p className="week-note">Todavía no hay una agenda semanal aprobada y publicada.</p>}
                <p className="week-note">{world.calendar.fridayReached
                  ? 'Hito del viernes alcanzado. El balance refleja las decisiones registradas.'
                  : 'El hito del viernes mostrará el balance de las decisiones registradas.'}</p>
                {world.calendar.weeklyTotal > 0 && <div className="week-balance">
                  <span>IMPACTO FISCAL DE LA SEMANA</span>
                  <strong>{world.calendar.weeklyTreasuryDeltaM > 0 ? '+' : ''}
                    {number(world.calendar.weeklyTreasuryDeltaM)} M€</strong>
                </div>}
              </section>
              <div className="section-heading"><h2>Expedientes</h2><span>{world.dossiers.length} disponibles en catálogo</span></div>
              <div className="dossier-list">
                {world.dossiers.map(d => {
                  const done = world.events.some(e => e.dossier_id === d.id)
                  return <button type="button" className={'dossier-item ' + (dossier?.id === d.id && dossier.version === d.version ? 'selected' : '')}
                    key={dossierKey(d)} onClick={() => selectDossier(d)}
                    aria-pressed={dossierKey(d) === dossierKey(dossier ?? d)}>
                    <span className="eyebrow">{d.category.toUpperCase()} · V{d.version}</span>
                    <strong>{d.title}</strong>
                    <small>{done ? 'RESUELTO' : available(d, world.gameDay) ? 'PENDIENTE' : 'NO DISPONIBLE'}</small>
                  </button>
                })}
              </div>
            </aside>
            <section className="main-panel" aria-label="Expediente político">
              {needsReconciliation && <div className="fictitious-notice" role="status">
                El resultado de la última operación está pendiente de confirmar.
                <button type="button" className="text-button" disabled={pending}
                  onClick={() => void reconcileWorld()}>Reintentar sincronización</button>
              </div>}
              {historicalEvent ? (
                <>
                  <div className="eyebrow">02 / ARCHIVO DE DECISIONES · {historicalEvent.decided_on}</div>
                  <h2>{historicalEvent.dossier_title_snapshot}</h2>
                  <button type="button" className="text-button archive-back"
                    onClick={() => setSelectedEventId(null)}>Volver a la agenda</button>
                  <div className="rule" />
                  <Outcome event={historicalEvent} optionTitle={historicalEvent.option_title_snapshot} />
                </>
              ) : dossier ? (
                <>
                  <div className="eyebrow">02 / CONSEJO DE MINISTROS · EXPEDIENTE {dossier.version.toString().padStart(2, '0')}</div>
                  <h2>{dossier.title}</h2>
                  <div className="rule" />
                  <p className="dossier-context">{dossier.context}</p>
                  {dossier.release_kind === 'intro' ? (
                    <div className="fictitious-notice">EXPEDIENTE INTRODUCTORIO · ESCENARIO FICTICIO, NO NOTICIA ACTUAL</div>
                  ) : (
                    <div className="editorial-source">
                      <span>EXPEDIENTE SEMANAL · FUENTE EDITORIAL</span>
                      {dossier.source_url && <a href={dossier.source_url}
                        target="_blank" rel="noopener noreferrer">
                        {dossier.source_title || 'Consultar fuente de referencia'} ↗
                      </a>}
                      {dossier.source_published_at && <small>Fuente publicada: {dossier.source_published_at.slice(0, 10)}</small>}
                    </div>
                  )}
                  {decision ? (
                    <Outcome event={decision} optionTitle={decision.option_title_snapshot} />
                  ) : available(dossier, world.gameDay) ? (
                    <fieldset className="choice-list" disabled={pending || needsReconciliation}>
                      <legend>Elige una línea de actuación</legend>
                      {options.map((option: DossierOption) => (
                        <label className={'choice-card ' + (optionId === option.id ? 'checked' : '')} key={option.id}>
                          <input type="radio" name="policy" value={option.id} checked={optionId === option.id}
                            onChange={() => { setOptionId(option.id); setReviewingDecision(false) }} />
                          <span className="choice-body"><strong>{option.title}</strong><small>{option.description}</small></span>
                          <span className="choice-arrow" aria-hidden="true">↗</span>
                        </label>
                      ))}
                      <button className="primary-button decide" type="button"
                        disabled={!selectedOption || pending || needsReconciliation}
                        onClick={() => setReviewingDecision(true)}>Revisar decisión</button>
                      {reviewingDecision && selectedOption && (
                        <section className="decision-review" aria-labelledby="decision-review-title" data-testid="decision-review">
                          <div className="eyebrow">REVISIÓN DEL DECRETO · EXPEDIENTE {dossier.version.toString().padStart(2, '0')}</div>
                          <h3 id="decision-review-title">Antes de firmar</h3>
                          <p className="review-intro">Comprueba la medida y su compromiso fiscal. La firma es definitiva.</p>
                          <div className="review-facts">
                            <div><span>MEDIDA SELECCIONADA</span><strong>{selectedOption.title}</strong>
                              <small>{selectedOption.description}</small></div>
                            <div><span>VARIACIÓN FISCAL DEL EXPEDIENTE</span>
                              <strong>{selectedOption.treasury_delta_m_eur > 0 ? '+' : ''}{number(selectedOption.treasury_delta_m_eur)} M€</strong>
                              <small>Parámetro editorial de la opción, no resultado ejecutado.</small></div>
                            <div><span>TESORERÍA ACTUAL</span><strong>{number(world.government.treasury_m_eur)} M€</strong>
                              <small>Estado persistido antes de decidir.</small></div>
                          </div>
                          <p className="review-warning">La aprobación, la confianza y la respuesta de la población se calcularán en el servidor tras la firma. No es posible deshacer la decisión.</p>
                          <div className="review-actions">
                            <button className="text-button" type="button" disabled={pending || needsReconciliation}
                              onClick={() => setReviewingDecision(false)}>Volver a elegir</button>
                            <button className="primary-button" type="button" disabled={pending || needsReconciliation}
                              onClick={() => void onDecision()}>
                              {pending ? 'Registrando decisión…' : 'Firmar y ejecutar decisión'}
                            </button>
                          </div>
                        </section>
                      )}
                      {!reviewingDecision && <p className="muted fine">La resolución será vinculante después de confirmar la firma.</p>}
                    </fieldset>
                  ) : <div className="fictitious-notice">Este expediente aún no está habilitado.</div>}
                </>
              ) : <p>No hay expedientes disponibles.</p>}
            </section>
            <aside className="metrics-panel">
              <div className="eyebrow">03 / ESTADO NACIONAL</div>
              <h2>Indicadores</h2>
              <div className="stat"><span>TESORERÍA PÚBLICA</span><strong>{number(world.government.treasury_m_eur)}<em> M€</em></strong><small>Estado persistido</small></div>
              <div className="stat"><span>APROBACIÓN DEL GOBIERNO</span><strong>{world.government.approval}<em>%</em></strong>
                <div className="meter" role="meter" aria-label="Aprobación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={world.government.approval}>
                  <span style={{ width: world.government.approval + '%' }} /></div></div>
              <div className="stat"><span>CONFIANZA INSTITUCIONAL</span><strong>{world.government.trust}<em>%</em></strong>
                <div className="meter" role="meter" aria-label="Confianza" aria-valuemin={0} aria-valuemax={100} aria-valuenow={world.government.trust}>
                  <span style={{ width: world.government.trust + '%' }} /></div></div>
              <h3 className="metric-subheading">Grupos representativos</h3>
              {world.cohorts.map(cohort => <div className="cohort-mini" key={cohort.code}>
                <span>{cohort.label}</span><strong>{cohort.support}%</strong><small>{cohort.population_weight}% población · {cohort.trust}% confianza</small>
              </div>)}
              <h3 className="metric-subheading">Historial de decisiones</h3>
              {world.events.length === 0 ? <p className="muted">Todavía no hay decisiones registradas.</p>
                : <ol className="history">{world.events.map(event => <li key={event.id}>
                  <button type="button" className={'history-entry ' + (selectedEventId === event.id ? 'selected' : '')}
                    aria-pressed={selectedEventId === event.id} onClick={() => selectHistory(event.id)}>
                    <strong>{event.option_title_snapshot}</strong>
                    <small>{event.dossier_title_snapshot} · {event.decided_on} · {event.engine_version}</small>
                  </button>
                </li>)}</ol>}
            </aside>
          </main>
          <LivingConditionsPanel governmentId={world.government.id} identity={user?.id ?? ''} />
          <PopulationPanel key={world.government.id + ':' + (user?.id ?? '')}
            governmentId={world.government.id} identity={user?.id ?? ''} />
          <DecisionAnalyticsPanel key={world.government.id}
            events={world.events} gameDay={world.gameDay}
            countryName={world.government.country_name} />
        </>
      )}
      {error && <div className="error-toast" role="alert"><strong>No se pudo completar la operación</strong><p>{error}</p>
        <button type="button" onClick={() => setError('')}>Cerrar aviso</button></div>}
      <footer className="footer"><span>ACT OF STATE · MVP 001</span><span>NINGUNA VENTAJA COMPETITIVA DE PAGO</span><span>EVERY DECISION SHAPES A NATION.</span></footer>
    </div>
  )
}
