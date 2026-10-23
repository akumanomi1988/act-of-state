import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DecisionEvent, Government, GovernmentWorld } from './types'

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
  // One PostgreSQL statement: state, choices, cohorts and history share a
  // consistent database snapshot. SECURITY INVOKER/RLS enforce ownership.
  const { data, error } = await requireClient().rpc('get_government_world', {
    p_government_id: governmentId
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('GOVERNMENT_NOT_FOUND_OR_FORBIDDEN')
  }
  const snapshot = data as Partial<GovernmentWorld>
  if (
    snapshot.government?.id !== governmentId ||
    typeof snapshot.gameDay !== 'string' ||
    typeof snapshot.calendar?.weekStart !== 'string' ||
    typeof snapshot.calendar?.friday !== 'string' ||
    typeof snapshot.calendar?.weeklyTotal !== 'number' ||
    typeof snapshot.calendar?.weeklyResolved !== 'number' ||
    typeof snapshot.calendar?.weeklyTreasuryDeltaM !== 'number' ||
    !Array.isArray(snapshot.dossiers) ||
    !Array.isArray(snapshot.options) ||
    !Array.isArray(snapshot.cohorts) ||
    !Array.isArray(snapshot.events)
  ) {
    throw new Error('El estado nacional recibido no es válido.')
  }
  return snapshot as GovernmentWorld
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
