import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { client, friendlyError } from './lib/game'
import NewsDiscoveryPanel, { type NewsCandidate } from './NewsDiscoveryPanel'
import {
  editorialError, editorialReady, fetchEditorialRole, fetchEditorialWeek,
  isMonday, newEditorialDossier, nextMondayUtc, publishEditorialWeek,
  saveEditorialWeek, type EditorialDossier, type EditorialOption,
  type EditorialRole, type EditorialWeek
} from './lib/editorial'

const SLOTS = 10
const optionIds = ['option-a', 'option-b', 'option-c', 'option-d']

function slotDraft(week: string, saved: EditorialDossier[] = []): EditorialDossier[] {
  return Array.from({ length: SLOTS }, (_, index) => {
    const blank = newEditorialDossier(week, index + 1)
    return saved.find(item => item.id === blank.id) ?? blank
  })
}

function localDateTime(iso: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return ''
  const date = new Date(iso)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16)
}

function positiveInteger(raw: string): number {
  const value = Number(raw)
  return Number.isFinite(value) ? Math.trunc(value) : 0
}

export default function EditorialApp() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [email, setEmail] = useState('')
  const [mailSent, setMailSent] = useState(false)
  const [role, setRole] = useState<EditorialRole | null>(null)
  const [permissionReady, setPermissionReady] = useState(false)
  const [week, setWeek] = useState(nextMondayUtc)
  const [snapshot, setSnapshot] = useState<EditorialWeek | null>(null)
  const [draft, setDraft] = useState<EditorialDossier[]>(() => slotDraft(nextMondayUtc()))
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [pending, setPending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const ownerRef = useRef<string | null>(null)
  const requestRef = useRef(0)

  function acceptUser(next: User | null) {
    const nextId = next?.id ?? null
    if (ownerRef.current !== nextId) {
      requestRef.current += 1
      setPending(false)
    }
    ownerRef.current = nextId
    setUser(next)
  }

  useEffect(() => {
    if (!client) { setAuthReady(true); return }
    let alive = true
    let authRevision = 0
    const initialRevision = authRevision
    client.auth.getUser().then(({ data, error: authError }) => {
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
    setRole(null)
    setPermissionReady(false)
    setSnapshot(null)
    setDraft(slotDraft(week))
    setDirty(false)
    setReviewing(false)
    setError('')
    setNotice('')
    if (!user || !isMonday(week)) {
      setLoading(false)
      setPermissionReady(true)
      return
    }
    const owner = user.id
    const request = ++requestRef.current
    setLoading(true)
    const active = () => ownerRef.current === owner && requestRef.current === request
    const run = async () => {
      try {
        const grantedRole = await fetchEditorialRole(owner)
        if (!active()) return
        setRole(grantedRole)
        setPermissionReady(true)
        if (!grantedRole) return
        const saved = await fetchEditorialWeek(week)
        if (!active()) return
        setSnapshot(saved)
        setDraft(slotDraft(week, saved?.draft))
      } catch (reason) {
        if (active()) setError(editorialError(reason))
      } finally {
        if (active()) { setLoading(false); setPermissionReady(true) }
      }
    }
    void run()
    return () => { requestRef.current += 1 }
  }, [user?.id, week, reload])

  const dossier = draft[selectedSlot]
  const readyCount = useMemo(() => draft.filter(editorialReady).length, [draft])
  const complete = readyCount === SLOTS
  const isPublished = snapshot?.status === 'published'
  const canEdit = !!role && !isPublished && !loading && !pending

  function updateDossier<K extends keyof EditorialDossier>(key: K, value: EditorialDossier[K]) {
    if (!canEdit) return
    setDraft(current => current.map((item, index) =>
      index === selectedSlot ? { ...item, [key]: value } : item))
    setDirty(true)
    setReviewing(false)
    setNotice('')
  }

  function applyNewsSource(article: NewsCandidate) {
    if (!canEdit) return
    setDraft(current => current.map((item, index) =>
      index === selectedSlot ? { ...item, source_title: article.title,
        source_url: article.url, source_published_at: article.publishedAt } : item))
    setDirty(true)
    setReviewing(false)
    setNotice('')
  }

  function updateOption(index: number, field: keyof EditorialOption, value: string | number) {
    if (!canEdit) return
    setDraft(current => current.map((item, slot) => slot !== selectedSlot ? item : {
      ...item,
      options: item.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option)
    }))
    setDirty(true)
    setReviewing(false)
    setNotice('')
  }

  function addOption() {
    if (!canEdit || dossier.options.length >= 4) return
    const id = optionIds.find(item => !dossier.options.some(option => option.id === item))
    if (!id) return
    updateDossier('options', [...dossier.options, {
      id, title: '', description: '', treasury_delta_m_eur: 0,
      policy_target: 50, response_intensity: 20, trust_base_delta: 0
    }])
  }

  function removeOption(index: number) {
    if (!canEdit || dossier.options.length <= 2) return
    updateDossier('options', dossier.options.filter((_, i) => i !== index))
  }

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client) return
    setPending(true)
    setError('')
    try {
      const { error: authError } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin + '/editorial' }
      })
      if (authError) setError(friendlyError(authError))
      else setMailSent(true)
    } catch (reason) {
      setError(friendlyError(reason))
    } finally { setPending(false) }
  }

  async function onSave() {
    if (!canEdit || !dirty || !user) return
    const owner = user.id
    const targetWeek = week
    const request = requestRef.current
    setPending(true)
    setError('')
    setNotice('')
    try {
      const saved = await saveEditorialWeek(targetWeek, snapshot?.revision ?? 0, draft)
      if (ownerRef.current !== owner || requestRef.current !== request) return
      setSnapshot(saved)
      setDraft(slotDraft(targetWeek, saved.draft))
      setDirty(false)
      setNotice('Borrador guardado en el servidor · revisión ' + saved.revision)
    } catch (reason) {
      if (ownerRef.current === owner && requestRef.current === request)
        setError(editorialError(reason))
    } finally {
      if (ownerRef.current === owner && requestRef.current === request) setPending(false)
    }
  }

  async function onPublish() {
    if (role !== 'publisher' || !reviewing || dirty || !complete || !snapshot ||
      isPublished || pending || !user) return
    const owner = user.id
    const targetWeek = week
    const request = requestRef.current
    setPending(true)
    setError('')
    setNotice('')
    let failure: unknown = null
    try {
      await publishEditorialWeek(targetWeek, snapshot.revision)
    } catch (reason) { failure = reason }
    // A successful database commit can outlive a lost HTTP response.
    try {
      const persisted = await fetchEditorialWeek(targetWeek)
      if (ownerRef.current !== owner || requestRef.current !== request) return
      if (persisted?.status === 'published') {
        setSnapshot(persisted)
        setDraft(slotDraft(targetWeek, persisted.draft))
        setReviewing(false)
        setNotice('Agenda publicada y aprobada: diez expedientes visibles en el juego.')
      } else if (failure) {
        setError(editorialError(failure))
      } else {
        setError('La publicación no pudo verificarse. Recarga antes de intentarlo de nuevo.')
      }
    } catch (reason) {
      if (ownerRef.current === owner && requestRef.current === request)
        setError('No se pudo reconciliar la publicación: ' + editorialError(reason))
    } finally {
      if (ownerRef.current === owner && requestRef.current === request) setPending(false)
    }
  }

  async function onSignOut() {
    if (!client) return
    setPending(true)
    setError('')
    const { error: authError } = await client.auth.signOut()
    if (authError) setError(friendlyError(authError))
    setPending(false)
  }

  return <div className="app-shell">
    <header className="masthead">
      <div className="brand-group">
        <div className="brand-symbol" aria-hidden="true">A<span>✦</span>S</div>
        <div><div className="wordmark">ACT OF STATE</div>
          <div className="brand-caption">EDITORIAL CONTROL ROOM</div></div>
      </div>
      <div className="header-end">
        <a className="text-button" href="/">Volver al gobierno</a>
        {user && <button className="text-button" onClick={() => void onSignOut()}
          disabled={pending}>Cerrar sesión</button>}
      </div>
    </header>
    <div className="session-strip"><span>AGENDA POLÍTICA · CONTROL EDITORIAL</span>
      <span>PUBLICACIÓN AUTORIZADA · FUENTES VERIFICABLES</span></div>

    {!authReady ? <main className="editorial-state"><p role="status">Comprobando sesión…</p></main>
    : !client ? <main className="editorial-state">
      <h1>Servicio no configurado</h1><p>Falta la conexión segura al servidor.</p>
    </main>
    : !user ? <main className="editorial-state">
      <p className="eyebrow">ACCESO RESTRINGIDO</p>
      <h1>La mesa editorial</h1>
      <p className="muted">Elabora la agenda nacional con trazabilidad de fuentes y aprobación independiente. El acceso requiere una cuenta autorizada.</p>
      <form onSubmit={event => void onLogin(event)} className="editorial-login">
        <label htmlFor="editorial-email">Correo electrónico</label>
        <input id="editorial-email" type="email" value={email}
          onChange={event => setEmail(event.target.value)} required autoComplete="email" />
        <button type="submit" disabled={pending}>{pending ? 'Enviando…' : 'Recibir enlace de acceso'}</button>
      </form>
      {mailSent && <p role="status">Enlace enviado. Comprueba tu correo electrónico.</p>}
      {error && <p className="editorial-alert" role="alert">{error}</p>}
    </main>
    : loading || !permissionReady ? <main className="editorial-state">
      <p role="status">Cargando permisos y agenda persistente…</p>
    </main>
    : !role ? <main className="editorial-state">
      <p className="eyebrow">SIN AUTORIZACIÓN EDITORIAL</p>
      <h1>Acceso denegado</h1>
      <p className="muted">Tu identidad está autenticada, pero no pertenece al equipo editorial. Un administrador debe conceder el rol fuera del navegador.</p>
      {error && <p className="editorial-alert" role="alert">{error}</p>}
    </main>
    : <main className="editorial-layout">
      <aside className="editorial-rail">
        <p className="eyebrow">MESA DE REDACCIÓN</p>
        <h1>Agenda semanal</h1>
        <div className="editorial-badge">{role === 'publisher' ? 'PUBLICADOR' : 'EDITOR'}</div>
        <label className="editorial-field" htmlFor="editorial-week">Lunes de publicación
          <input id="editorial-week" type="date" value={week} disabled={pending}
            onChange={event => { setWeek(event.target.value); setSelectedSlot(0) }} />
        </label>
        {!isMonday(week) && <p className="editorial-alert" role="alert">La fecha debe ser un lunes.</p>}
        <div className="editorial-progress-label">
          <span>Expedientes listos</span><strong>{readyCount} / 10</strong>
        </div>
        <div className="editorial-progress" role="progressbar" aria-label="Expedientes preparados"
          aria-valuemin={0} aria-valuemax={10} aria-valuenow={readyCount}>
          <span style={{ width: (readyCount * 10) + '%' }} />
        </div>
        <nav className="editorial-slots" aria-label="Expedientes de la semana">
          {draft.map((item, index) => <button key={item.id} type="button"
            className={'editorial-slot ' + (index === selectedSlot ? 'active ' : '') +
              (editorialReady(item) ? 'ready' : '')}
            onClick={() => { setSelectedSlot(index); setReviewing(false) }}
            aria-current={index === selectedSlot ? 'step' : undefined}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <span>{item.title || 'Expediente pendiente'}</span>
            <span aria-label={editorialReady(item) ? 'Completo' : 'Incompleto'}>
              {editorialReady(item) ? '✓' : '·'}</span>
          </button>)}
        </nav>
        <p className="editorial-small">Las diez noticias deben contrastarse externamente. El sistema valida datos y autoría, pero no certifica su veracidad.</p>
      </aside>

      <section className="editorial-work">
        <div className="editorial-toolbar">
          <div><p className="eyebrow">EXPEDIENTE {String(selectedSlot + 1).padStart(2, '0')} / 10</p>
            <h2>Ficha de decisión</h2></div>
          <span className={'editorial-status ' + (isPublished ? 'published' : '')}>
            {isPublished ? 'PUBLICADO' : dirty ? 'CAMBIOS SIN GUARDAR' :
              snapshot ? 'BORRADOR GUARDADO' : 'BORRADOR NUEVO'}
          </span>
        </div>
        <p className="muted">Cada expediente publicado pasa al motor de simulación existente. Los impactos son parámetros editoriales validados; los resultados se calculan en el servidor cuando el jugador decide.</p>
        <div className="editorial-form">
          <div className="editorial-row">
            <label className="editorial-field">Título político
              <input aria-label="Título político" value={dossier.title} maxLength={160}
                disabled={!canEdit} onChange={event => updateDossier('title', event.target.value)}
                placeholder="Una decisión concreta de gobierno" />
              <small>Mínimo 8 caracteres</small>
            </label>
            <label className="editorial-field">Área de política
              <input aria-label="Área de política" value={dossier.category} maxLength={80}
                disabled={!canEdit} onChange={event => updateDossier('category', event.target.value)}
                placeholder="Economía, energía, vivienda…" />
            </label>
          </div>
          <label className="editorial-field">Contexto y dilema
            <textarea aria-label="Contexto y dilema" rows={5} maxLength={3000}
              disabled={!canEdit} value={dossier.context}
              onChange={event => updateDossier('context', event.target.value)}
              placeholder="Describe hechos, actores, restricciones y consecuencias políticas…" />
            <small>Entre 40 y 3.000 caracteres. Redacción neutral y verificable.</small>
          </label>
          <NewsDiscoveryPanel disabled={!canEdit}
            usedUrls={draft.filter((_, index) => index !== selectedSlot).map(item => item.source_url)}
            onPick={applyNewsSource} />
          <div className="editorial-source-fields">
            <p className="eyebrow">PROCEDENCIA DOCUMENTAL</p>
            <div className="editorial-row">
              <label className="editorial-field">Título de la fuente
                <input aria-label="Título de la fuente" value={dossier.source_title} maxLength={300}
                  disabled={!canEdit} onChange={event => updateDossier('source_title', event.target.value)}
                  placeholder="Titular original del medio o institución" />
              </label>
              <label className="editorial-field">Publicada (hora local)
                <input aria-label="Fecha de la fuente" type="datetime-local"
                  disabled={!canEdit} value={localDateTime(dossier.source_published_at)}
                  onChange={event => updateDossier('source_published_at',
                    event.target.value ? new Date(event.target.value).toISOString() : '')} />
              </label>
            </div>
            <label className="editorial-field">Enlace HTTPS a la fuente
              <input aria-label="Enlace a la fuente" type="url" value={dossier.source_url}
                disabled={!canEdit} onChange={event => updateDossier('source_url', event.target.value)}
                placeholder="https://…" />
            </label>
          </div>

          <div className="editorial-options-header">
            <div><p className="eyebrow">ELECCIONES Y EFECTOS</p>
              <h3>Opciones políticas</h3></div>
            <button className="text-button" onClick={addOption} disabled={!canEdit || dossier.options.length >= 4}>
              + Añadir opción
            </button>
          </div>
          {dossier.options.map((option, optionIndex) => <fieldset className="editorial-option" key={option.id} disabled={!canEdit}>
            <legend>OPCIÓN {String.fromCharCode(65 + optionIndex)} · {option.id}</legend>
            <div className="editorial-row">
              <label className="editorial-field">Decisión
                <input aria-label={'Decisión ' + option.id} value={option.title} maxLength={160}
                  onChange={event => updateOption(optionIndex, 'title', event.target.value)} />
              </label>
              {dossier.options.length > 2 && <button type="button" className="text-button"
                onClick={() => removeOption(optionIndex)}>Quitar opción</button>}
            </div>
            <label className="editorial-field">Descripción y compromiso
              <textarea aria-label={'Descripción ' + option.id} rows={3} maxLength={1500}
                value={option.description}
                onChange={event => updateOption(optionIndex, 'description', event.target.value)} />
            </label>
            <div className="editorial-parameter-grid">
              {([
                ['treasury_delta_m_eur', 'Tesoro (M€)', -12000, 12000],
                ['policy_target', 'Orientación (0–100)', 0, 100],
                ['response_intensity', 'Intensidad (0–100)', 0, 100],
                ['trust_base_delta', 'Confianza base (−20 a +20)', -20, 20]
              ] as const).map(([field, label, min, max]) =>
                <label className="editorial-field" key={field}>{label}
                  <input type="number" aria-label={label + ' ' + option.id}
                    min={min} max={max} step={1} value={option[field]}
                    onChange={event => updateOption(optionIndex, field,
                      positiveInteger(event.target.value))} />
                </label>)}
            </div>
          </fieldset>)}
        </div>
      </section>

      <aside className="editorial-review">
        <p className="eyebrow">GOBERNANZA DE PUBLICACIÓN</p>
        <h2>Control de calidad</h2>
        <div className="editorial-check"><span>01</span>
          <div><strong>Integridad</strong><p>{readyCount} de 10 fichas completas y validadas localmente.</p></div></div>
        <div className="editorial-check"><span>02</span>
          <div><strong>Persistencia</strong><p>Revisión {snapshot?.revision ?? 0}. {dirty ? 'Hay cambios sin guardar.' :
            snapshot ? 'Borrador sincronizado.' : 'Sin guardar todavía.'}</p></div></div>
        <div className="editorial-check"><span>03</span>
          <div><strong>Separación de funciones</strong><p>Solo un publicador puede ejecutar la transacción final.</p></div></div>
        <div className="editorial-check"><span>04</span>
          <div><strong>Fuentes</strong><p>Se exige referencia HTTPS y fecha publicada no futura. La verificación factual corresponde a la redacción.</p></div></div>
        <div className="editorial-actions">
          <button onClick={() => void onSave()} disabled={!canEdit || !dirty}>
            {pending ? 'Procesando…' : 'Guardar borrador'}
          </button>
          {role === 'publisher' && !isPublished && <button className="editorial-publish"
            disabled={pending || dirty || !complete || !snapshot}
            onClick={() => setReviewing(true)}>Revisar publicación</button>}
          {reviewing && !isPublished && <div className="editorial-confirm">
            <strong>Publicación irreversible</strong>
            <p>Se aprobarán exactamente diez expedientes para la semana del {week}. No se pueden editar tras publicar.</p>
            <button onClick={() => void onPublish()} disabled={pending || dirty || !complete}>
              Confirmar y publicar
            </button>
            <button className="text-button" onClick={() => setReviewing(false)}
              disabled={pending}>Cancelar</button>
          </div>}
          <button className="text-button" disabled={pending || loading}
            onClick={() => { if (dirty && !window.confirm('¿Descartar los cambios sin guardar?')) return
              setReload(current => current + 1) }}>Recargar desde servidor</button>
        </div>
        {isPublished && <p role="status" className="editorial-success">Esta agenda ya está aprobada y bloqueada para edición.</p>}
        {notice && <p role="status" className="editorial-success">{notice}</p>}
        {error && <p role="alert" className="editorial-alert">{error}</p>}
        <p className="editorial-small">La aprobación, la unicidad y la atomicidad se imponen en PostgreSQL. El navegador nunca calcula resultados del juego.</p>
      </aside>
    </main>}
    <footer className="footer"><span>ACT OF STATE · EVERY DECISION SHAPES A NATION</span>
      <span>EDITORIAL WORKBENCH · SERVER AUTHORITATIVE</span></footer>
  </div>
}
