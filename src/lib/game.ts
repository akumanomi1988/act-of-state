import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DecisionEvent, Dossier, DossierOption, Government, GovernmentWorld, PopulationCohort } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Do not embed server keys or service_role credentials in browser code.
export const client: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null

export function requireClient(): SupabaseClient {
  if (!client) throw new Error('No se ha configurado una base de datos ACT OF STATE.')
  return client
}

export async function startGovernment(): Promise<Government> {
  const { data, error } = await requireClient().rpc('start_government')
  if (error) throw error
  if (!data || Array.isArray(data)) throw new Error('No se pudo recuperar la sesión de gobierno.')
  return data as Government
}

export async function fetchWorld(governmentId: string): Promise<GovernmentWorld> {
  const db = requireClient()
  const [government, dossiers, options, cohorts, events, day] = await Promise.all([
    db.from('governments').select('*').eq('id', governmentId).single(),
    db.from('dossiers').select('*').order('id').order('version', { ascending: false }),
    db.from('dossier_options').select('*').order('dossier_id').order('id'),
    db.from('population_cohorts').select('*').eq('government_id', governmentId).order('code'),
    db.from('decision_events').select('*').eq('government_id', governmentId).order('created_at', { ascending: false }),
    db.rpc('get_game_day')
  ])
  for (const response of [government, dossiers, options, cohorts, events, day]) {
    if (response.error) throw response.error
  }
  if (!government.data || !day.data) throw new Error('No se pudo recuperar el estado nacional.')
  return {
    government: government.data as Government,
    dossiers: (dossiers.data ?? []) as Dossier[],
    options: (options.data ?? []) as DossierOption[],
    cohorts: (cohorts.data ?? []) as PopulationCohort[],
    events: (events.data ?? []) as DecisionEvent[],
    gameDay: day.data as string
  }
}

export async function submitDecision(
  governmentId: string, dossierId: string, dossierVersion: number, optionId: string
): Promise<DecisionEvent> {
  const { data, error } = await requireClient().rpc('submit_decision', {
    p_government_id: governmentId,
    p_dossier_id: dossierId,
    p_dossier_version: dossierVersion,
    p_option_id: optionId
  })
  if (error) throw error
  if (!data || Array.isArray(data)) throw new Error('La decisión no devolvió un resultado verificable.')
  return data as DecisionEvent
}

const errors: Record<string, string> = {
  AUTH_REQUIRED: 'Debes iniciar sesión.',
  GOVERNMENT_NOT_FOUND_OR_FORBIDDEN: 'No tienes acceso a este gobierno.',
  DOSSIER_ALREADY_DECIDED: 'Ya has resuelto este expediente con otra opción.',
  DOSSIER_NOT_AVAILABLE: 'El expediente no está disponible en la fecha del juego.',
  INVALID_OPTION: 'La opción seleccionada no es válida.',
  INSUFFICIENT_TREASURY: 'La tesorería es insuficiente para esta medida.',
  POPULATION_NOT_INITIALIZED: 'No se ha podido inicializar la población.'
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return errors[message] ?? (message.includes('JWT') ? 'La sesión ha caducado. Accede de nuevo.' : message)
}
