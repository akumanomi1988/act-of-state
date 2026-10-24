import type { EditorialDossier, EditorialOption } from './editorial'

/**
 * Deterministic fictional policy scenarios. A citation is not evidence
 * that any proposed measure has actually been announced or implemented.
 * Publisher review remains mandatory for all ten saved dossiers.
 */
const categories: Record<string,{ subject: string; publicCost: number; target: number }> = {
  'Economía': { subject: 'la política fiscal, el empleo y la competitividad', publicCost: 1200, target: 65 },
  'Instituciones': { subject: 'la organización institucional y los servicios públicos', publicCost: 450, target: 40 },
  'Relaciones exteriores': { subject: 'la cooperación exterior y las relaciones diplomáticas', publicCost: 650, target: 55 }
}

export function draftPolicyScenario(dossier: EditorialDossier): EditorialDossier {
  if (!dossier.source_url || !dossier.source_title.trim() ||
      !dossier.title.trim()) return dossier
  const category = categories[dossier.category] ?? {
    subject: 'una decisión sobre políticas públicas', publicCost: 700, target: 50
  }
  const context = 'Escenario hipotético de simulación política relacionado con ' +
    category.subject + '. El gabinete debe decidir si adopta una intervención pública, ' +
    'una respuesta gradual o mantiene el marco vigente, teniendo en cuenta costes ' +
    'presupuestarios, apoyo social y confianza institucional. Las alternativas son ' +
    'propuestas ficticias del juego, no afirmaciones sobre medidas reales ni sobre ' +
    'el contenido de la noticia citada.'
  const options: EditorialOption[] = [
    { id: 'option-a', title: 'Impulsar una intervención pública',
      description: 'Activar una actuación estatal intensiva sobre ' + category.subject +
        ', aceptando el gasto fiscal inmediato y una respuesta social más marcada.',
      treasury_delta_m_eur: -category.publicCost, policy_target: Math.max(0, category.target-20),
      response_intensity: 55, trust_base_delta: 2 },
    { id: 'option-b', title: 'Negociar una respuesta gradual',
      description: 'Introducir una actuación gradual sobre ' + category.subject +
        ', con evaluación institucional y una asignación presupuestaria contenida.',
      treasury_delta_m_eur: -Math.round(category.publicCost/3),
      policy_target: category.target, response_intensity: 30, trust_base_delta: 1 },
    { id: 'option-c', title: 'Mantener el marco vigente',
      description: 'Conservar la estrategia actual sobre ' + category.subject +
        ', evitando nuevos compromisos presupuestarios y aplazando la intervención.',
      treasury_delta_m_eur: 0, policy_target: Math.min(100,category.target+20),
      response_intensity: 20, trust_base_delta: -1 }
  ]
  const missingContext=!dossier.context.trim()
  const missingOptions=!dossier.options.some(option=>option.title.trim()||option.description.trim())
  if (!missingContext&&!missingOptions) return dossier
  return { ...dossier,context:missingContext?context:dossier.context,
    options:missingOptions?options:dossier.options }
}

export function preparePolicyScenarios(dossiers: EditorialDossier[]) {
  let updated=0
  const draft=dossiers.map(dossier=>{
    const next=draftPolicyScenario(dossier)
    if(next!==dossier)updated+=1
    return next
  })
  return {draft,updated}
}
