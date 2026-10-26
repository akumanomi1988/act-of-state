import { requireClient } from './game'

export type EditorialRole = 'editor' | 'publisher'

export interface EditorialOption {
  id: string
  title: string
  description: string
  treasury_delta_m_eur: number
  policy_target: number
  response_intensity: number
  trust_base_delta: number
}

export interface EditorialDossier {
  id: string
  title: string
  context: string
  category: string
  source_url: string
  source_title: string
  source_published_at: string
  options: EditorialOption[]
}

export interface EditorialWeek {
  week_start: string
  revision: number
  status: 'draft' | 'published'
  draft: EditorialDossier[]
  updated_at: string
  published_at: string | null
}

export function nextMondayUtc(): string {
  const day = new Date()
  const offset = (8 - (day.getUTCDay() || 7)) % 7
  day.setUTCDate(day.getUTCDate() + offset)
  return day.toISOString().slice(0, 10)
}

export function isMonday(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 1 &&
    date.toISOString().slice(0, 10) === value
}

export function newEditorialDossier(week: string, slot: number): EditorialDossier {
  return {
    id: 'weekly-' + week + '-' + String(slot).padStart(2, '0'),
    title: '', context: '', category: '', source_url: '', source_title: '',
    source_published_at: '',
    options: [
      { id: 'option-a', title: '', description: '', treasury_delta_m_eur: 0,
        policy_target: 50, response_intensity: 20, trust_base_delta: 0 },
      { id: 'option-b', title: '', description: '', treasury_delta_m_eur: 0,
        policy_target: 50, response_intensity: 20, trust_base_delta: 0 }
    ]
  }
}

export function editorialReady(d: EditorialDossier): boolean {
  const published = Date.parse(d.source_published_at)
  return d.title.trim().length >= 8 && d.title.length <= 160 &&
    d.context.trim().length >= 40 && d.context.length <= 3000 &&
    d.category.trim().length >= 3 && d.category.length <= 80 &&
    d.source_title.trim().length >= 5 && d.source_title.length <= 300 &&
    /^https:\/\/[^\s]+$/.test(d.source_url) && d.source_url.length <= 2048 &&
    Number.isFinite(published) && published <= Date.now() &&
    d.options.length === 5 &&
    new Set(d.options.map(o => o.id)).size === 5 &&
    new Set(d.options.map(o => o.title.trim().toLowerCase())).size === 5 &&
    new Set(d.options.map(o => o.policy_target)).size === 5 &&
    d.options.every(o => /^[a-z0-9-]+$/.test(o.id) &&
      o.title.trim().length >= 4 && o.title.length <= 160 &&
      o.description.trim().length >= 12 && o.description.length <= 1500 &&
      Number.isInteger(o.treasury_delta_m_eur) && Math.abs(o.treasury_delta_m_eur) <= 12000 &&
      Number.isInteger(o.policy_target) && o.policy_target >= 0 && o.policy_target <= 100 &&
      Number.isInteger(o.response_intensity) && o.response_intensity >= 0 &&
      o.response_intensity <= 100 &&
      Number.isInteger(o.trust_base_delta) && o.trust_base_delta >= -20 &&
      o.trust_base_delta <= 20)
}

export async function fetchEditorialRole(userId: string): Promise<EditorialRole | null> {
  const { data, error } = await requireClient().from('editorial_members')
    .select('role').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data?.role === 'editor' || data?.role === 'publisher' ? data.role : null
}

export async function fetchEditorialWeek(week: string): Promise<EditorialWeek | null> {
  const { data, error } = await requireClient().from('editorial_weeks')
    .select('week_start,revision,status,draft,updated_at,published_at')
    .eq('week_start', week).maybeSingle()
  if (error) throw error
  if (!data) return null
  if (data.week_start !== week || !Array.isArray(data.draft) ||
    typeof data.revision !== 'number' ||
    (data.status !== 'draft' && data.status !== 'published')) {
    throw new Error('EDITORIAL_INVALID_SNAPSHOT')
  }
  return data as EditorialWeek
}

export async function saveEditorialWeek(
  week: string, expectedRevision: number, dossiers: EditorialDossier[]
): Promise<EditorialWeek> {
  const { data, error } = await requireClient().rpc('save_editorial_week', {
    p_week_start: week, p_expected_revision: expectedRevision, p_draft: dossiers
  })
  if (error) throw error
  if (!data || Array.isArray(data) || data.week_start !== week ||
    typeof data.revision !== 'number') throw new Error('EDITORIAL_INVALID_SNAPSHOT')
  return data as EditorialWeek
}

export async function publishEditorialWeek(
  week: string, expectedRevision: number
): Promise<EditorialWeek> {
  const { data, error } = await requireClient().rpc('publish_editorial_week', {
    p_week_start: week, p_expected_revision: expectedRevision
  })
  if (error) throw error
  if (!data || Array.isArray(data) || data.week_start !== week ||
    data.status !== 'published') throw new Error('EDITORIAL_INVALID_SNAPSHOT')
  return data as EditorialWeek
}

const messages: Record<string, string> = {
  EDITORIAL_FORBIDDEN: 'Esta cuenta no tiene permisos editoriales.',
  EDITORIAL_REQUIRES_TEN_REVIEWS: 'Se requieren diez revisiones editoriales vigentes.',
  EDITORIAL_REVIEW_INCOMPLETE: 'La ficha debe estar completa y guardada para su revisión.',
  EDITORIAL_STAFF_FORBIDDEN: 'Solo un publicador puede administrar el equipo editorial.',
  EDITORIAL_LAST_PUBLISHER: 'No puedes retirar el último publicador.',
  EDITORIAL_STAFF_ACCOUNT_UNAVAILABLE: 'La cuenta indicada no existe o no ha confirmado el correo.',
  EDITORIAL_PUBLISH_FORBIDDEN: 'Solo el rol publicador puede aprobar la agenda.',
  EDITORIAL_INVALID_WEEK: 'Selecciona un lunes de la semana actual o futura.',
  EDITORIAL_REVISION_CONFLICT: 'Otro editor ha guardado cambios. Recarga antes de continuar.',
  EDITORIAL_ALREADY_PUBLISHED: 'La semana está publicada y no puede modificarse.',
  EDITORIAL_REQUIRES_TEN_DISTINCT_DOSSIERS: 'La agenda requiere diez expedientes completos y distintos.',
  EDITORIAL_INVALID_DOSSIER_CONTENT: 'Revisa título, contexto y fuente de los expedientes.',
  EDITORIAL_INVALID_SOURCE_DATE: 'La fecha de la fuente debe ser válida y no futura.',
  EDITORIAL_INVALID_OPTIONS: 'Cada expediente necesita de dos a cuatro opciones válidas.',
  EDITORIAL_INVALID_OPTION_PARAMETERS: 'Hay parámetros de simulación fuera de los límites admitidos.',
  EDITORIAL_INVALID_SNAPSHOT: 'La respuesta editorial del servidor no es válida.'
}

export function editorialError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const key = Object.keys(messages).find(code => message.includes(code))
  return key ? messages[key] : message
}
