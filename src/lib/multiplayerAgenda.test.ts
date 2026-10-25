import { describe, expect, it } from 'vitest'
import type { Dossier, DecisionEvent } from './types'
import type { MatchWorld, MatchStance } from './multiplayer'
import { buildMatchAgenda, isCurrentDossier, visibleMatchDossiers } from './multiplayerAgenda'

const current = '2026-10-25'
const hostId = '00000000-0000-4000-8000-000000000001'
const opponentId = '00000000-0000-4000-8000-000000000002'
const intro = (id: string): Dossier => ({ id, version:1, title:id, context:'Test context',
  category:'Institutions', release_kind:'intro', available_from:null, available_until:null })
const weekly = (id: string, from='2026-10-19', until='2026-10-25'): Dossier => ({
  ...intro(id), release_kind:'weekly', available_from:from, available_until:until
})
function makeWorld(): MatchWorld {
  return {
    match: { id:'match-1', title:'Session', status:'active',host_user_id:hostId,
      government_id:'g1',invite_code:'a'.repeat(32),created_at:'2026-10-19',
      started_at:'2026-10-20', is_public:false,readiness_required:false,max_players:10 },
    me: { match_id:'match-1',user_id:hostId,seat_no:1,party_name:'Government',
      manifesto_policy:50,mandate_seats:55,joined_at:'2026-10-19',is_ready:true },
    gameDay: current,
    players:[],government:{id:'g1',owner_id:hostId,country_name:'Arcadia',
      treasury_m_eur:12345,approval:50,trust:52,created_at:'2026-10-19',updated_at:'2026-10-20'},
    cohorts:[],
    dossiers: [intro('energy'),intro('housing'),weekly('weekly-1'),weekly('weekly-2')],
    options:[],events:[],stances:[]
  }
}
function signed(id: string): DecisionEvent {
  return {
    id:'event-'+id,government_id:'g1',dossier_id:id,dossier_version:1,
    option_id:'decision',dossier_title_snapshot:id,option_title_snapshot:'decision',
    engine_version:'weighted-cohorts-v1',decided_on:current,
    state_before:{treasury_m_eur:12000,approval:50,trust:50},
    state_after:{treasury_m_eur:11000,approval:53,trust:51},
    cohort_effects:[],parameters_snapshot:{treasury_delta_m_eur:-1000,
      policy_target:50,response_intensity:20,trust_base_delta:1},created_at:current
  }
}
function stance(user_id: string, dossier_id: string): MatchStance {
  return { match_id:'match-1',user_id,dossier_id,dossier_version:1,option_id:'decision',
    policy_affinity:50,engine_version:'policy-affinity-v1',created_at:current }
}

describe('real match political action board', () => {
  it('promotes server-published weekly dossiers ahead of all permanent introductions', () => {
    const state = buildMatchAgenda(makeWorld(),hostId)
    expect(state.items.map(item=>item.dossier.id)).toEqual(['weekly-1','weekly-2','energy','housing'])
    expect(state.weekly).toEqual({total:2,signed:0,stances:0})
    expect(state.foundation).toEqual({total:2,signed:0,stances:0})
    expect(state.role).toBe('cabinet')
    expect(state.next?.dossier.id).toBe('weekly-1')
  })

  it('derives immutable decisions from shared server events and each member own stance', () => {
    const world=makeWorld()
    world.events=[signed('weekly-1'), signed('housing')]
    world.stances=[stance(opponentId,'energy'),stance(hostId,'weekly-2')]
    const host=buildMatchAgenda(world,hostId)
    const opposition=buildMatchAgenda(world,opponentId)
    expect(host.weekly).toEqual({total:2,signed:1,stances:1})
    expect(host.foundation).toEqual({total:2,signed:1,stances:0})
    expect(opposition.weekly.stances).toBe(0)
    expect(opposition.foundation.stances).toBe(1)
    expect(host.next?.dossier.id).toBe('energy')
    expect(opposition.next?.dossier.id).toBe('weekly-2')
    expect(visibleMatchDossiers(host,'signed').map(x=>x.dossier.id))
      .toEqual(['weekly-1','housing'])
    expect(visibleMatchDossiers(host,'action').map(x=>x.dossier.id)).toEqual(['weekly-2','energy'])
    expect(visibleMatchDossiers(opposition,'action').map(x=>x.dossier.id)).toEqual(['weekly-2'])
  })

  it('does not treat a stance, vote or published news as a signed national decision', () => {
    const world=makeWorld()
    world.stances=[stance(hostId,'energy')]
    const agenda=buildMatchAgenda(world,hostId)
    expect(agenda.foundation.signed).toBe(0)
    expect(agenda.items.find(x=>x.dossier.id==='energy')?.status).toBe('stance-recorded')
    expect(agenda.items.every(x=>!x.signed)).toBe(true)
  })

  it('honours the UTC publication/expiry window and excludes unavailable action items', () => {
    const world=makeWorld()
    world.dossiers=[weekly('future','2026-10-26','2026-10-30'),
      weekly('expired','2026-10-19','2026-10-24'),intro('open')]
    const agenda=buildMatchAgenda(world,opponentId)
    expect(agenda.next?.dossier.id).toBe('open')
    expect(visibleMatchDossiers(agenda,'action').map(x=>x.dossier.id)).toEqual(['open'])
    expect(agenda.items.find(x=>x.dossier.id==='expired')?.status).toBe('unavailable')
    expect(isCurrentDossier(weekly('boundary','2026-10-25','2026-10-25'),current)).toBe(true)
  })

  it('keeps zero-deadline weeks explicitly empty and does not fabricate missing content', () => {
    const world=makeWorld();world.dossiers=[intro('energy')]
    const agenda=buildMatchAgenda(world,opponentId)
    expect(agenda.weekly).toEqual({total:0,signed:0,stances:0})
    expect(visibleMatchDossiers(agenda,'weekly')).toEqual([])
  })
})
