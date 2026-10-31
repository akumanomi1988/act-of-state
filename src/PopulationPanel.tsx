import { useEffect, useMemo, useState } from 'react'
import { fetchPopulationProfile, type PopulationDimension, type PopulationProfile } from './lib/population'
import { number } from './lib/format'

interface Props {
  governmentId: string
  identity: string
}

const dimensions: Record<PopulationDimension, string> = {
  age: 'Generaciones', income: 'Ingresos', settlement: 'Entorno', cohort: 'Intereses', district: 'Circunscripciones'
}
const labels: Record<string, string> = {
  young: 'Jóvenes', working: 'Edad laboral', senior: 'Mayores',
  low: 'Ingresos bajos', middle: 'Ingresos medios', high: 'Ingresos altos',
  urban: 'Ciudades', rural: 'Medio rural',
  households: 'Hogares y trabajadores', industry: 'Industria y emprendedores',
  capital: 'Distrito Capital', industrial: 'Corredor Industrial',
  coastal: 'Región Costera', agrarian: 'Llanuras Agrarias',
  highland: 'Territorios de Montaña', frontier: 'Frontera Interior'
}

function calibratedLabel(code: string, dimension: PopulationDimension, model: string) {
  if (model === 'households-v3' && dimension === 'settlement') {
    return code === 'urban' ? 'Municipios de 10.000 habitantes o más' :
      code === 'rural' ? 'Municipios de menos de 10.000 habitantes' : code
  }
  return labels[code] ?? code
}

export default function PopulationPanel({ governmentId, identity }: Props) {
  const [profile, setProfile] = useState<PopulationProfile | null>(null)
  const [dimension, setDimension] = useState<PopulationDimension>('income')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    let alive = true
    setProfile(null)
    setError('')
    async function refresh() {
      try {
        const data = await fetchPopulationProfile(governmentId)
        if (alive) { setProfile(data); setError('') }
      } catch {
        if (alive) setError('No se ha podido recuperar la población simulada.')
      }
    }
    void refresh()
    const poll = window.setInterval(() => { void refresh() }, 60000)
    return () => { alive = false; window.clearInterval(poll) }
  }, [governmentId, identity])
  const rows = useMemo(() =>
    (profile?.segments ?? []).filter(s => s.dimension === dimension),
    [profile,dimension]
  )

  return <section className="population-panel" aria-label="Población sintética">
    <div className="population-panel-heading">
      <div>
        <p className="eyebrow">SIMULADOR SOCIAL · HOGARES SINTÉTICOS</p>
        <h2>La población detrás de tus decisiones</h2>
        <p className="muted">Agentes familiares sintéticos con características y reacciones distintas.
          No representan a ciudadanos reales ni son resultados de encuestas.</p>
      </div>
      <button type="button" className="text-button" aria-expanded={expanded}
        aria-controls="population-panel-details" onClick={() => setExpanded(v => !v)}>
        {expanded ? 'Ocultar población' : 'Explorar población'}
      </button>
    </div>
    {profile && <p className="population-sample">
      <strong>{number(profile.households)}</strong> hogares ·
      {' '}{number(profile.sampleResidents)} integrantes de una muestra sintética persistente
    </p>}
    {error && <p role="alert">{error}</p>}
    {!profile && !error && <p role="status">Cargando segmentos demográficos…</p>}
    {expanded && profile && <div id="population-panel-details">
      <div className="population-dimensions" role="group" aria-label="Dimensión demográfica">
        {(Object.entries(dimensions) as [PopulationDimension,string][]).map(([key,label]) =>
          <button key={key} type="button" aria-pressed={dimension === key}
            className={dimension === key ? 'selected' : ''}
            onClick={() => setDimension(key)}>{label}</button>)}
      </div>
      <div className="population-segments">
        {rows.map(segment => <article className="population-segment" key={dimension+segment.code}>
          <div className="population-segment-label">
            <h3>{calibratedLabel(segment.code,dimension,profile.modelVersion)}</h3>
            <span>{segment.households} hogares · {segment.residents} integrantes
              {dimension === 'district' && profile.districts &&
                ' · ' + (profile.districts.find(d => d.code === segment.code)?.seats ?? 0) +
                ' escaños territoriales'}</span>
          </div>
          <div className="population-meter-label">
            <span>Apoyo político</span><strong>{segment.support}%</strong>
          </div>
          <div className="population-meter" role="progressbar"
            aria-label={'Apoyo de '+(calibratedLabel(segment.code,dimension,profile.modelVersion))}
            aria-valuenow={segment.support} aria-valuemin={0} aria-valuemax={100}>
            <span style={{width:segment.support+'%'}} />
          </div>
          <div className="population-meter-label">
            <span>Confianza institucional</span><strong>{segment.trust}%</strong>
          </div>
          <div className="population-meter trust" role="progressbar"
            aria-label={'Confianza de '+(calibratedLabel(segment.code,dimension,profile.modelVersion))}
            aria-valuenow={segment.trust} aria-valuemin={0} aria-valuemax={100}>
            <span style={{width:segment.trust+'%'}} />
          </div>
        </article>)}
      </div>
      <p className="muted">Las intervenciones públicas y liquidaciones económicas cambian las
        preferencias de los hogares en el servidor. Las elecciones agregan el voto de esta muestra
        mediante ponderación por integrantes y reparto D’Hondt
        por circunscripción. Las regiones son territorios sintéticos, no
        estadísticas demográficas de lugares reales.</p>
    </div>}
  </section>
}
