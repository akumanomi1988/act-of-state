import { useMemo, useState } from 'react'
import {
  DEMO_CASES, INITIAL_METRICS, applyDemoDecision, clearDemoProgress,
  emptyDemoProgress, evaluateDemo, loadDemoProgress, saveDemoProgress,
  type DemoMetrics
} from './demo/demoEngine'
import { number } from './lib/format'
import { demoCasesFor } from './demo/demoEnglish'
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
  const [language,setLanguage]=useState<'es'|'en'>(()=>{
    return new URLSearchParams(window.location.search).get('lang')==='en'?'en':'es'
  })
  const en=language==='en'
  const t=(es:string,english:string)=>en?english:es
  function chooseLanguage(next:'es'|'en') {
    const url=new URL(window.location.href)
    url.searchParams.set('lang',next)
    window.history.replaceState(window.history.state,'',url)
    setLanguage(next)
  }
  const cases=useMemo(()=>demoCasesFor(language),[language])
  const labels=metricLabels.map(item=>({...item,label:en?({
    treasury:'Treasury',approval:'Approval',trust:'Institutional trust',
    households:'Household support',companies:'Business support'
  } as const)[item.key]:item.label}))
  const [progress, setProgress] = useState(loadDemoProgress)
  const [selectedId, setSelectedId] = useState(DEMO_CASES[0].id)
  const [choiceId, setChoiceId] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const snapshot = useMemo(() => evaluateDemo(progress), [progress])
  const dossier = cases.find(item => item.id === selectedId) ?? cases[0]
  const outcome = snapshot.history.find(item => item.caseId === dossier.id)
  const choice = dossier.choices.find(item => item.id === choiceId)
  const next = cases.find(item => !snapshot.history.some(event => event.caseId === item.id))
  const finished = snapshot.history.length === cases.length

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
        ? t('Medida registrada en el ensayo de este navegador.','Training decision saved in this browser.')
        : t('Medida registrada solo en esta pestaña; el navegador no permite guardarla.','Training decision applied in this tab only; browser storage is unavailable.'))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('No se ha podido aplicar esta opción.','This choice could not be applied.'))
    }
  }

  function reset() {
    setProgress(emptyDemoProgress())
    clearDemoProgress()
    chooseDossier(DEMO_CASES[0].id)
    setConfirmReset(false)
    setNotice(t('Ensayo reiniciado. Todas las decisiones de prueba se han descartado.','Training reset. All practice decisions were discarded.'))
  }

  return <div className="app-shell demo-shell">
    <header className="masthead">
      <div className="brand-group">
        <span className="brand-symbol" aria-hidden="true">A<span>／</span>S</span>
        <div><div className="wordmark">ACT OF STATE</div><div className="brand-caption">EVERY DECISION SHAPES A NATION.</div></div>
      </div>
      <nav className="header-end" aria-label={t('Navegación principal','Main navigation')}>
        <a className="text-button" href="/guide">{t("Manual","Guide")}</a>
        <a className="text-button" href="/multiplayer">{t("Asambleas","Assemblies")}</a>
        <a className="primary-button demo-access" href="/">{t("Entrar al juego real","Enter the real game")}</a>
      </nav>
    </header>

    <main className="demo-wrap" lang={language}>
      <div className="demo-language" role="group" aria-label={t('Idioma del ensayo','Demo language')}>
        <button type="button" aria-pressed={!en} onClick={()=>chooseLanguage('es')}>Español</button>
        <button type="button" aria-pressed={en} onClick={()=>chooseLanguage('en')}>English</button>
      </div>
      <section className="demo-lead" aria-labelledby="demo-title">
        <div className="eyebrow">{t("LABORATORIO DE DECISIONES · ACCESO INMEDIATO","POLICY LAB · INSTANT ACCESS")}</div>
        <h1 id="demo-title">{t("Gobierna antes de registrarte.","Govern before signing up.")}</h1>
        <p>{t("Cuatro dilemas, doce alternativas y una nación ficticia. Practica los compromisos entre presupuesto, aprobación y confianza sin crear cuenta.","Four dilemmas, twelve options and one fictional country. Explore trade-offs between budget, approval and public trust without an account.")}</p>
        <div className="fictitious-notice demo-disclaimer" role="note">
          <strong>{t("MODO DE ENSAYO, NO PARTIDA OFICIAL.","TRAINING MODE — NOT AN OFFICIAL GAME.")}</strong>{' '}{t('Los efectos son cifras didácticas predefinidas, no cálculos del motor real ni predicciones. No hay elecciones, servidor, noticias reales ni multijugador. Ninguna acción modifica tu gobierno persistente.','Effects are pre-authored educational examples, not the real game engine or predictions. There are no elections, server requests, current news or multiplayer. No action changes your persistent government.')}
        </div>
      </section>

      <section className="demo-summary" aria-label={t('Balance del ensayo','Training budget and approval')}>
        <div className="demo-summary-head">
          <div><div className="eyebrow">{t("REPÚBLICA FICTICIA DE ARCADIA","FICTIONAL REPUBLIC OF ARCADIA")}</div>
            <h2>{t("Tu gabinete de prueba","Your practice cabinet")}</h2></div>
          <span className="demo-progress" role="status">{snapshot.history.length} / {DEMO_CASES.length} {t('expedientes','dossiers')}</span>
        </div>
        <div className="demo-metrics">
          {labels.map(item => <div className="demo-metric" key={item.key}>
            <span>{item.label}</span><strong>{number(snapshot.metrics[item.key])}{item.suffix}</strong>
            <small>{t('Inicio:','Start:')} {number(INITIAL_METRICS[item.key])}{item.suffix}</small>
          </div>)}
        </div>
      </section>

      <div className="demo-grid">
        <aside className="demo-sidebar" aria-label={t('Agenda de expedientes','Dossier agenda')}>
          <div className="eyebrow">{t("01 / AGENDA DE GOBIERNO","01 / GOVERNMENT AGENDA")}</div>
          <h2>{t("Expedientes","Dossiers")}</h2>
          <p className="muted">{t("Puedes resolverlos en cualquier orden. Cada uno admite una única decisión, reversible solo al reiniciar.","Solve them in any order. Each dossier allows one irreversible choice until you reset the demo.")}</p>
          <div className="dossier-list">
            {cases.map(item => {
              const decided = snapshot.history.some(event => event.caseId === item.id)
              return <button type="button" key={item.id}
                className={'dossier-item ' + (item.id === dossier.id ? 'selected' : '')}
                aria-pressed={item.id === dossier.id}
                onClick={() => chooseDossier(item.id)}>
                <small>{item.category.toUpperCase()}</small>
                <strong>{item.title}</strong>
                <small>{decided ? t('DECIDIDO','DECIDED') : t('POR RESOLVER','PENDING')}</small>
              </button>
            })}
          </div>
        </aside>

        <section className="demo-main" aria-labelledby="demo-dossier-title">
          <div className="eyebrow">{t('02 / CONSEJO DE MINISTROS','02 / CABINET COUNCIL')} · {dossier.category.toUpperCase()}</div>
          <h2 id="demo-dossier-title">{dossier.title}</h2>
          <div className="rule" />
          <p className="dossier-context">{dossier.context}</p>
          {outcome ? <section className="demo-outcome" aria-labelledby="demo-outcome-title">
            <div className="eyebrow">{t("ACTA DE ENSAYO · MEDIDA EJECUTADA","TRAINING RECORD · POLICY APPLIED")}</div>
            <h3 id="demo-outcome-title">{dossier.choices.find(c=>c.id===outcome.optionId)?.title ?? outcome.optionTitle}</h3>
            <p className="muted">{t("Este efecto está calculado a partir de parámetros ficticios del ensayo.","This outcome is calculated from the fictional training parameters.")}</p>
            <div className="demo-impacts">
              {labels.map(item => <div key={item.key}>
                <span>{item.label}</span>
                <strong>{number(outcome.after[item.key])}{item.suffix}</strong>
                <small>{signed(outcome.after[item.key] - outcome.before[item.key], item.suffix)} {t('desde el estado previo','from the previous state')}</small>
              </div>)}
            </div>
            {next ? <button className="primary-button" type="button"
              onClick={() => chooseDossier(next.id)}>{t("Siguiente expediente pendiente","Next unfinished dossier")}</button> :
              <p className="success">{t("Has resuelto los cuatro expedientes del ensayo.","You have completed all four practice dossiers.")}</p>}
          </section> : <>
            <fieldset className="choice-list">
              <legend>{t("Elige una política para Arcadia","Choose a policy for Arcadia")}</legend>
              {dossier.choices.map(option => <label key={option.id}
                className={'choice-card ' + (choiceId === option.id ? 'checked' : '')}>
                <input type="radio" name="demo-choice" value={option.id}
                  checked={choiceId === option.id}
                  onChange={() => { setChoiceId(option.id); setReviewing(false); setError('') }} />
                <span className="choice-body"><strong>{option.title}</strong>
                  <small>{option.description}</small>
                  <small>{t('Coste fiscal orientativo:','Illustrative fiscal cost:')} {signed(option.effects.treasury, ' M€')}</small>
                </span>
              </label>)}
            </fieldset>
            {!reviewing ? <button type="button" className="primary-button decide"
              disabled={!choice} onClick={() => setReviewing(true)}>{t("Revisar medida de prueba","Review practice choice")}</button> :
              <section className="decision-review" aria-label={t('Confirmación del ensayo','Training confirmation')}>
                <div className="eyebrow">{t("PASO FINAL · CONFIRMACIÓN","FINAL STEP · CONFIRMATION")}</div>
                <h3>{choice?.title}</h3>
                <p className="muted">{t("No se enviará ninguna solicitud al servidor. La medida quedará guardada únicamente en este navegador cuando el almacenamiento esté permitido.","No request will be sent to the game server. This practice choice is saved only in this browser when storage is allowed.")}</p>
                <div className="demo-impacts">
                  {labels.map(item => <div key={item.key}>
                    <span>{item.label}</span>
                    <strong>{signed(choice?.effects[item.key] ?? 0, item.suffix)}</strong>
                    <small>{t("Impacto ilustrativo previsto","Illustrative projected impact")}</small>
                  </div>)}
                </div>
                <div className="review-actions">
                  <button type="button" className="text-button" onClick={() => setReviewing(false)}>{t("Cambiar opción","Change choice")}</button>
                  <button type="button" className="primary-button" onClick={signDecision}>{t("Aplicar medida de prueba","Apply practice choice")}</button>
                </div>
              </section>}
          </>}
          {error && <p className="demo-error" role="alert">{error}</p>}
          {notice && <p className="demo-notice" role="status">{notice}</p>}
        </section>
      </div>

      <section className="demo-history" aria-labelledby="demo-history-title">
        <div><div className="eyebrow">{t("03 / RENDICIÓN DE CUENTAS","03 / ACCOUNTABILITY")}</div>
          <h2 id="demo-history-title">{t("Registro de este ensayo","This demo's decision history")}</h2>
          {snapshot.history.length === 0 ? <p className="muted">{t("Todavía no has firmado ninguna medida de prueba.","No practice measures have been signed yet.")}</p> :
            <ol>{snapshot.history.map((event, index) => <li key={event.caseId}>
              <button type="button" className="text-button"
                onClick={() => chooseDossier(event.caseId)}>
                {index + 1}. {cases.find(c=>c.id===event.caseId)?.title ?? event.dossierTitle} · {cases.find(c=>c.id===event.caseId)?.choices.find(c=>c.id===event.optionId)?.title ?? event.optionTitle}
              </button>
              <span>{signed(event.after.treasury - event.before.treasury, ' M€')}</span>
            </li>)}</ol>}
        </div>
        <div className="demo-completion">
          <h3>{finished ? t('Ensayo completado','Demo completed') : t('Cuando estés listo, continúa.','Continue when ready.')}</h3>
          <p>{t("Una partida auténtica requiere iniciar sesión. Allí las decisiones se ejecutan de forma transaccional en el servidor y afectan a un estado persistente independiente de esta demostración.","An official game requires signing in. Decisions are then committed transactionally on the server and affect a persistent country completely separate from this demo.")}</p>
          <a href="/" className="primary-button">{t("Crear mi gobierno real","Create my real government")}</a>
          <div className="demo-reset">
            {confirmReset ? <div role="group" aria-label={t('Confirmar reinicio del ensayo','Confirm demo reset')}>
              <p>{t("¿Borrar todas las decisiones de este ensayo?","Delete all practice decisions?")}</p>
              <button type="button" className="text-button" onClick={reset}>{t("Sí, reiniciar ensayo","Yes, reset the demo")}</button>{' '}
              <button type="button" className="text-button" onClick={() => setConfirmReset(false)}>{t("Cancelar","Cancel")}</button>
            </div> : <button type="button" className="text-button" onClick={() => setConfirmReset(true)}>{t("Reiniciar ensayo","Reset demo")}</button>}
          </div>
        </div>
      </section>
    </main>
    <footer className="footer"><span>{t("ACT OF STATE · ENTORNO DE PRUEBA LOCAL","ACT OF STATE · LOCAL TRAINING ENVIRONMENT")}</span><span>{t("Sin cuenta · Sin sincronización con partidas oficiales","No account · No synchronization with official games")}</span></footer>
  </div>
}
