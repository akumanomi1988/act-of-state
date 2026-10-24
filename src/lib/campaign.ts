import { requireClient } from './game'

export type CampaignStrategy = 'dialogue' | 'field_visit' | 'policy_forum'

export interface CampaignCohort {
  code: string
  label: string
  weight: number
  idealPolicy: number
  myInfluence: number
}

export interface CampaignAct {
  id: string
  user_id: string
  party_name: string
  week_start: string
  cohort_code: string
  strategy: CampaignStrategy
  influence_delta: number
  influence_after: number
  model_version: 'campaign-outreach-v1'
  created_at: string
}

export interface CampaignState {
  serverDay: string
  weekStart: string
  campaignClosesOn: string | null
  available: boolean
  usedThisWeek: boolean
  cohorts: CampaignCohort[]
  recentActs: CampaignAct[]
}

function validState(raw: unknown): raw is CampaignState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const obj = raw as Partial<CampaignState>
  return typeof obj.serverDay === 'string'
    && typeof obj.weekStart === 'string'
    && typeof obj.available === 'boolean'
    && typeof obj.usedThisWeek === 'boolean'
    && Array.isArray(obj.cohorts)
    && Array.isArray(obj.recentActs)
    && (obj.campaignClosesOn === null || typeof obj.campaignClosesOn === 'string')
}

export async function fetchCampaignState(matchId: string): Promise<CampaignState> {
  const { data, error } = await requireClient().rpc('get_campaign_state', {
    p_match_id: matchId
  })
  if (error) throw error
  if (!validState(data)) throw new Error('CAMPAIGN_INVALID_RESPONSE')
  return data
}

export async function launchPartyCampaign(
  matchId: string, cohort: string, strategy: CampaignStrategy
): Promise<CampaignAct> {
  if (!cohort || cohort.length > 80 || !['dialogue','field_visit','policy_forum'].includes(strategy))
    throw new Error('CAMPAIGN_INVALID_INPUT')
  const { data, error } = await requireClient().rpc('launch_campaign', {
    p_match_id: matchId, p_cohort: cohort, p_strategy: strategy
  })
  if (error) throw error
  if (!data?.id || data.cohort_code !== cohort || data.strategy !== strategy)
    throw new Error('CAMPAIGN_INVALID_RESPONSE')
  return data as CampaignAct
}
