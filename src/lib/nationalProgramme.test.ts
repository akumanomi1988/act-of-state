import {describe,expect,it} from 'vitest'
import type {Dossier,DecisionEvent} from './types'
import {buildProgrammeProgress,chapterOf,reformChapter,CHAPTERS} from './nationalProgramme'

const intro=(id:string,chapter:Dossier['programme_chapter']='founding',
  order=1):Dossier=>({id,version:1,title:id,category:'Game',
  context:'Fictional test',release_kind:'intro',available_from:null,
  available_until:null,programme_chapter:chapter,programme_order:order})
const event=(id:string):DecisionEvent=>({
  id:'event-'+id,government_id:'government',dossier_id:id,dossier_version:1,
  option_id:'option',dossier_title_snapshot:id,option_title_snapshot:'Option',
  engine_version:'weighted-cohorts-v1',decided_on:'2026-10-25',
  created_at:'2026-10-25T00:00:00Z',cohort_effects:[],
  parameters_snapshot:{treasury_delta_m_eur:-20,policy_target:50,
    response_intensity:20,trust_base_delta:1},
  state_before:{treasury_m_eur:12000,approval:50,trust:50},
  state_after:{treasury_m_eur:11980,approval:51,trust:51}
})
describe('permanent national reform chapters',()=>{
  it('keeps all ten original pre-migration founding dossiers in chapter one',()=>{
    const ten=Array.from({length:10},(_,i)=>intro('old-'+i,undefined,i+1))
    const result=buildProgrammeProgress(ten,[])
    expect(result).toMatchObject({total:10,signed:0})
    expect(result.chapters[0]).toMatchObject({id:'founding',total:10,next:ten[0]})
    expect(CHAPTERS.map(c=>c.id)).toEqual([
      'founding','society','economy','institutions','resilience','diplomacy'])
  })
  it('separates 18 reforms from ten founding and excluded fake news',()=>{
    const legacy=Array.from({length:10},(_,i)=>intro('old-'+i,'founding',i+1))
    const reform=Array.from({length:18},(_,i)=>
      intro('new-'+i,(['society','economy','institutions','resilience'] as const)
        [i%4],Math.floor(i/4)+1))
    const fakeNews={...intro('news'),release_kind:'weekly' as const,
      available_from:'2026-10-26',available_until:'2026-10-30'}
    const result=buildProgrammeProgress([...reform,fakeNews,...legacy],
      [event('old-1'),event('new-0'),event('new-5')])
    expect(result).toMatchObject({total:28,signed:3})
    expect(result.chapters[0]).toMatchObject({total:10,signed:1,pending:9})
    expect(result.chapters.slice(1).reduce((n,c)=>n+c.total,0)).toBe(18)
    expect(result.chapters.slice(1).reduce((n,c)=>n+c.signed,0)).toBe(2)
    expect(result.chapters[0].next?.id).toBe('old-0')
    expect(chapterOf(fakeNews)).toBeNull()
    expect(reformChapter(fakeNews)).toBe(false)
  })
  it('renders ordered progression independently of API sorting',()=>{
    const shuffled=[intro('third','society',3),intro('first','society',1),
      intro('second','society',2)]
    const result=buildProgrammeProgress(shuffled,[event('first')])
    const society=result.chapters.find(c=>c.id==='society')!
    expect(society.dossiers.map(x=>x.id)).toEqual(['first','second','third'])
    expect(society.next?.id).toBe('second')
    expect(society.signed).toBe(1)
    expect(reformChapter(shuffled[0])).toBe(true)
  })
  it('does not let a different dossier version count as a signed reform',()=>{
    const d=intro('pending','resilience')
    const old={...event('pending'),dossier_version:2}
    const result=buildProgrammeProgress([d],[old])
    expect(result).toMatchObject({total:1,signed:0})
    expect(result.next?.id).toBe('pending')
  })
  it('is resistant to duplicate event IDs and unknown chapter input',()=>{
    const old=intro('x',undefined)
    const broken={...intro('z'),programme_chapter:'garbage' as never}
    const result=buildProgrammeProgress([old,broken],[event('x'),event('x')])
    expect(result).toMatchObject({total:2,signed:1})
    expect(result.chapters[0].next?.id).toBe('z')
    expect(chapterOf(broken)).toBe('founding')
  })
})
