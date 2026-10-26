export interface Government {
  id: string
  owner_id: string
  country_name: string
  treasury_m_eur: number
  approval: number
  trust: number
  created_at: string
  updated_at: string
}

export interface PopulationCohort {
  id: string
  government_id: string
  code: string
  label: string
  population_weight: number
  ideal_policy: number
  support: number
  trust: number
}

export interface Dossier {
  id: string
  version: number
  title: string
  context: string
  category: string
  release_kind: 'intro' | 'weekly'
  programme_chapter?: 'founding' | 'society' | 'economy' | 'institutions' | 'resilience' | 'diplomacy' | null
  programme_order?: number | null
  available_from: string | null
  available_until: string | null
  source_url?: string | null
  source_title?: string | null
  source_published_at?: string | null
}

export interface DossierOption {
  dossier_id: string
  dossier_version: number
  id: string
  title: string
  description: string
  treasury_delta_m_eur: number
  policy_target: number
  response_intensity: number
  trust_base_delta: number
}

export interface GovernmentState {
  treasury_m_eur: number
  approval: number
  trust: number
}

export interface CohortEffect {
  code: string
  label: string
  population_weight: number
  support_before: number
  support_after: number
  trust_before: number
  trust_after: number
}

export interface DecisionEvent {
  id: string
  government_id: string
  dossier_id: string
  dossier_version: number
  option_id: string
  dossier_title_snapshot: string
  option_title_snapshot: string
  engine_version: string
  decided_on: string
  state_before: GovernmentState
  state_after: GovernmentState
  cohort_effects: CohortEffect[]
  parameters_snapshot: {
    treasury_delta_m_eur: number
    policy_target: number
    response_intensity: number
    trust_base_delta: number
  }
  created_at: string
}

export interface WeeklyCalendar {
  weekStart: string
  friday: string
  dayOfWeek: number
  fridayReached: boolean
  weeklyTotal: number
  weeklyResolved: number
  weeklyTreasuryDeltaM: number
}

export interface GovernmentWorld {
  government: Government
  gameDay: string
  calendar: WeeklyCalendar
  dossiers: Dossier[]
  options: DossierOption[]
  cohorts: PopulationCohort[]
  events: DecisionEvent[]
}
