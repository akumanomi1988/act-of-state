import { requireClient } from './game'

export type PopulationDimension = 'age' | 'income' | 'settlement' | 'cohort'

export interface PopulationSegment {
  dimension: PopulationDimension
  code: string
  households: number
  residents: number
  support: number
  trust: number
}

export interface PopulationProfile {
  modelVersion: 'households-v1'
  households: number
  sampleResidents: number
  segments: PopulationSegment[]
}

export function validatePopulationProfile(value: unknown): value is PopulationProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const profile = value as Partial<PopulationProfile>
  return profile.modelVersion === 'households-v1'
    && profile.households === 300
    && Number.isInteger(profile.sampleResidents)
    && profile.sampleResidents! > 0
    && Array.isArray(profile.segments)
    && profile.segments.every(s =>
      ['age','income','settlement','cohort'].includes(s.dimension)
      && typeof s.code === 'string'
      && Number.isInteger(s.households) && s.households >= 1
      && Number.isInteger(s.residents) && s.residents >= s.households
      && Number.isInteger(s.support) && s.support >= 0 && s.support <= 100
      && Number.isInteger(s.trust) && s.trust >= 0 && s.trust <= 100)
}

export async function fetchPopulationProfile(governmentId: string): Promise<PopulationProfile> {
  const { data, error } = await requireClient().rpc('get_population_profile', {
    p_government_id: governmentId
  })
  if (error) throw error
  if (!validatePopulationProfile(data)) throw new Error('POPULATION_INVALID_RESPONSE')
  return data
}
