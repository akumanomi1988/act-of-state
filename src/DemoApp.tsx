import { useMemo, useState } from 'react'
import {
  DEMO_CASES, INITIAL_METRICS, applyDemoDecision, clearDemoProgress,
  emptyDemoProgress, evaluateDemo, loadDemoProgress, saveDemoProgress,
  type DemoMetrics
} from './demo/demoEngine'
import { number } from './lib/format'
import './demo.css'

const metricLabels: { key: keyof DemoMetrics; label: string; suffix: string }[] = [
  { key: 'treasury', label: 'Tesorería', suffix: ' M€' },
  { key: 'approval', label: 'Aprobación', suffix: '%' },
  { key: 'trust', label: 'Confianza institucional', suffix: '%' },
  { key: 'households', label: 'Apoyo de hogares', suffix: '%' },
  { key: 'companies', label: 'Apoyo de empresas', suffix: '%' }
]

function signed(value: number, suffix: string) {
  return (value > 0 ? '+' : '') + number(value) + suffix
}

export default function DemoApp() {
  const [progress, setProgress] = useState(loadDemoProgress)
  const [selectedId, setSelectedId] = useState(DEMO_CASES[0].id)
  const [choiceId, setChoiceId] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const snapshot = useMemo(() => evaluateDemo(progress), [progress])
  const dossier = DEMO_CASES.find(item => item.id === selectedId) ?? DEMO_CASES[0]
  const outcome = snapshot.history.find(item => item.caseId === dossier.id)
  const choice = dossier.choices.find(item => item.id === choiceId)
  const next = DEMO_CASES.find(item => !snapshot.history.some(event => event.caseId === item.id))
  const finished = snapshot.history.length === DEMO_CASES.length

  function chooseDossier(id: string) {
    setSelectedId(id)
    setChoiceId('')
    setReviewing(false)
    setError('')
    setNotice('')
    setConfirmReset(false)
  }

  function signDecision() {
    if (!choice || !reviewing || outcome) return
    try {
      const nextState = applyDemoDecision(progress, dossier.id, choice.id)
      setProgress(nextState)
      setReviewing(false)
      setChoiceId('')
      setError('')
      setNotice(saveDemoProgress(nextState)
        ? 'Medida registrada en el ensayo de este navegador.'
        : 'Medida registrada solo en esta pestaña; el navegador no permite guardarla.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido aplicar esta opción.')
    }
  }

  function reset() {
    setProgress(emptyDemoProgress())
    clearDemoProgress()
    chooseDossier(DEMO_CASES[0].id)
    setConfirmReset(false)
    setNotice('Ensayo reiniciado. Todas las decisiones de prueba se han descartado.')
  }

  return <div className="app-shell demo-shell">
    <header className="masthead">
      <div className="brand-group">
        <span className="brand-symbol" aria-hidden="true">A<span>／</span>S</span>
        <div><div className="wordmark">ACT OF STATE</div><div className="brand-caption">EVERY DECISION SHAPES A NATION.</div></div>
      </div>
      <nav className="header-end" aria-label="Navegación principal">
        <a className="text-button" href="/guide">Manual</a>
        <a className="text-button" href="/multiplayer">Asambleas</a>
        <a className="primary-button demo-access" href="/">Entrar al juego real</a>
      </nav>
    </header>

    <main className="demo-wrap">
      <section className="demo-lead" aria-labelledby="demo-title">
        <div className="eyebrow">LABORATORIO DE DECISIONES · ACCESO INMEDIATO</div>
        <h1 id="demo-title">Gobierna antes de registrarte.</h1>
        <p>Cuatro dilemas, doce alternativas y una nación ficticia. Practica los compromisos entre presupuesto, aprobación y confianza sin crear cuenta.</p>
        <div className="fictitious-notice demo-disclaimer" role="note">
          <strong>MODO DE ENSAYO, NO PARTIDA OFICIAL.</strong> Los efectos son cifras didácticas predefinidas, no cálculos del motor real ni predicciones. No hay elecciones, servidor, noticias reales ni multijugador. Ninguna acción modifica tu gobierno persistente.
        </div>
      </section>

      <section className="demo-summary" aria-label="Balance del ensayo">
        <div className="demo-summary-head">
          <div><div className="eyebrow">REPÚBLICA FICTICIA DE ARCADIA</div>
            <h2>Tu gabinete de prueba</h2></div>
          <span className="demo-progress" role="status">{snapshot.history.length} / {DEMO_CASES.length} expedientes</span>
        </div>
        <div className="demo-metrics">
          {metricLabels.map(item => <div className="demo-metric" key={item.key}>
            <span>{item.label}</span><strong>{number(snapshot.metrics[item.key])}{item.suffix}</strong>
            <small>Inicio: {number(INITIAL_METRICS[item.key])}{item.suffix}</small>
          </div>)}
        </div>
      </section>

      <div className="demo-grid">
        <aside className="demo-sidebar" aria-label="Agenda de expedientes">
          <div className="eyebrow">01 / AGENDA DE GOBIERNO</div>
          <h2>Expedientes</h2>
          <p className="muted">Puedes resolverlos en cualquier orden. Cada uno admite una única decisión, reversible solo al reiniciar.</p>
          <div className="dossier-list">
            {DEMO_CASES.map(item => {
              const decided = snapshot.history.some(event => event.caseId === item.id)
              return <button type="button" key={item.id}
                className={'dossier-item ' + (item.id === dossier.id ? 'selected' : '')}
                aria-pressed={item.id === dossier.id}
                onClick={() => chooseDossier(item.id)}>
                <small>{item.category.toUpperCase()}</small>
                <strong>{item.title}</strong>
                <small>{decided ? 'DECIDIDO' : 'POR RESOLVER'}</small>
              </button>
            })}
          </div>
        </aside>

        <section className="demo-main" aria-labelledby="demo-dossier-title">
          <div className="eyebrow">02 / CONSEJO DE MINISTROS · {dossier.category.toUpperCase()}</div>
          <h2 id="demo-dossier-title">{dossier.title}</h2>
          <div className="rule" />
          <p className="dossier-context">{dossier.context}</p>
          {outcome ? <section className="demo-outcome" aria-labelledby="demo-outcome-title">
            <div className="eyebrow">ACTA DE ENSAYO · MEDIDA EJECUTADA</div>
            <h3 id="demo-outcome-title">{outcome.optionTitle}</h3>
            <p className="muted">Este efecto está calculado a partir de parámetros ficticios del ensayo.</p>
            <div className="demo-impacts">
              {metricLabels.map(item => <div key={item.key}>
                <span>{item.label}</span>
                <strong>{number(outcome.after[item.key])}{item.suffix}</strong>
                <small>{signed(outcome.after[item.key] - outcome.before[item.key], item.suffix)} desde el estado previo</small>
              </div>)}
            </div>
            {next ? <button className="primary-button" type="button"
              onClick={() => chooseDossier(next.id)}>Siguiente expediente pendiente</button> :
              <p className="success">Has resuelto los cuatro expedientes del ensayo.</p>}
          </section> : <>
            <fieldset className="choice-list">
              <legend>Elige una política para Arcadia</legend>
              {dossier.choices.map(option => <label key={option.id}
                className={'choice-card ' + (choiceId === option.id ? 'checked' : '')}>
                <input type="radio" name="demo-choice" value={option.id}
                  checked={choiceId === option.id}
                  onChange={() => { setChoiceId(option.id); setReviewing(false); setError('') }} />
                <span className="choice-body"><strong>{option.title}</strong>
                  <small>{option.description}</small>
                  <small>Coste fiscal orientativo: {signed(option.effects.treasury, ' M€')}</small>
                </span>
              </label>)}
            </fieldset>
            {!reviewing ? <button type="button" className="primary-button decide"
              disabled={!choice} onClick={() => setReviewing(true)}>Revisar medida de prueba</button> :
              <section className="decision-review" aria-label="Confirmación del ensayo">
                <div className="eyebrow">PASO FINAL · CONFIRMACIÓN</div>
                <h3>{choice?.title}</h3>
                <p className="muted">No se enviará ninguna solicitud al servidor. La medida quedará guardada únicamente en este navegador cuando el almacenamiento esté permitido.</p>
                <div className="demo-impacts">
                  {metricLabels.map(item => <div key={item.key}>
                    <span>{item.label}</span>
                    <strong>{signed(choice?.effects[item.key] ?? 0, item.suffix)}</strong>
                    <small>Impacto ilustrativo previsto</small>
                  </div>)}
                </div>
                <div className="review-actions">
                  <button type="button" className="text-button" onClick={() => setReviewing(false)}>Cambiar opción</button>
                  <button type="button" className="primary-button" onClick={signDecision}>Aplicar medida de prueba</button>
                </div>
              </section>}
          </>}
          {error && <p className="demo-error" role="alert">{error}</p>}
          {notice && <p className="demo-notice" role="status">{notice}</p>}
        </section>
      </div>

      <section className="demo-history" aria-labelledby="demo-history-title">
        <div><div className="eyebrow">03 / RENDICIÓN DE CUENTAS</div>
          <h2 id="demo-history-title">Registro de este ensayo</h2>
          {snapshot.history.length === 0 ? <p className="muted">Todavía no has firmado ninguna medida de prueba.</p> :
            <ol>{snapshot.history.map((event, index) => <li key={event.caseId}>
              <button type="button" className="text-button"
                onClick={() => chooseDossier(event.caseId)}>
                {index + 1}. {event.dossierTitle} · {event.optionTitle}
              </button>
              <span>{signed(event.after.treasury - event.before.treasury, ' M€')}</span>
            </li>)}</ol>}
        </div>
        <div className="demo-completion">
          <h3>{finished ? 'Ensayo completado' : 'Cuando estés listo, continúa.'}</h3>
          <p>Una partida auténtica requiere iniciar sesión. Allí las decisiones se ejecutan de forma transaccional en el servidor y afectan a un estado persistente independiente de esta demostración.</p>
          <a href="/" className="primary-button">Crear mi gobierno real</a>
          <div className="demo-reset">
            {confirmReset ? <div role="group" aria-label="Confirmar reinicio del ensayo">
              <p>¿Borrar todas las decisiones de este ensayo?</p>
              <button type="button" className="text-button" onClick={reset}>Sí, reiniciar ensayo</button>{' '}
              <button type="button" className="text-button" onClick={() => setConfirmReset(false)}>Cancelar</button>
            </div> : <button type="button" className="text-button" onClick={() => setConfirmReset(true)}>Reiniciar ensayo</button>}
          </div>
        </div>
      </section>
    </main>
    <footer className="footer"><span>ACT OF STATE · ENTORNO DE PRUEBA LOCAL</span><span>Sin cuenta · Sin sincronización con partidas oficiales</span></footer>
  </div>
}
