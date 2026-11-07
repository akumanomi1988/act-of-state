import { cleanup,fireEvent,render,screen,within } from '@testing-library/react'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import WeeklyMissionControl from './WeeklyMissionControl'
import type { MatchWorld,MatchCalendar } from './lib/multiplayer'
import type { ParliamentState } from './lib/parliament'

const mocks=vi.hoisted(()=>({
  calendar:vi.fn(),parliament:vi.fn()
}))
vi.mock('./lib/multiplayer',()=>({
  fetchMatchCalendar:mocks.calendar,
  matchError:(error:unknown)=>error instanceof Error?error.message:String(error)
}))
vi.mock('./lib/parliament',()=>({fetchParliamentState:mocks.parliament}))
const host='00000000-0000-4000-8000-000000000001'
const guest='00000000-0000-4000-8000-000000000002'
function fixture():MatchWorld{
  return {
    match:{id:'match',title:'Arcadia',host_user_id:host,
      status:'active',government_id:'gov',invite_code:'a'.repeat(32),
      created_at:'2026-10-26',started_at:'2026-10-26',is_public:false,
      readiness_required:false,max_players:10},
    me:{match_id:'match',user_id:guest,seat_no:2,party_name:'Opposition',
      manifesto_policy:50,mandate_seats:10,joined_at:'2026-10-26',is_ready:true},
    players:[],cohorts:[],events:[],stances:[],options:[],
    government:{id:'gov',owner_id:host,country_name:'Arcadia',
      treasury_m_eur:12000,approval:50,trust:50,
      created_at:'2026-10-26',updated_at:'2026-10-26'},
    gameDay:'2026-10-27',
    dossiers:[{id:'weekly-1',version:1,title:'Ley de prueba editorial',
      context:'Only synthetic test',category:'Instituciones',release_kind:'weekly',
      available_from:'2026-10-26',available_until:'2026-10-30'}]
  }
}
const cal:MatchCalendar={gameDay:'2026-10-27',monday:'2026-10-26',
  friday:'2026-10-30',fridayReached:false,weeklyPublished:true,
  weeklyTotal:1,weeklyResolved:0,latestFriday:null}
const parliament:ParliamentState={serverNow:'2026-10-27T10:00:00Z',
  bills:[],votes:[]}
beforeEach(()=>{
  vi.clearAllMocks()
  mocks.calendar.mockResolvedValue(cal)
  mocks.parliament.mockResolvedValue(parliament)
})
afterEach(cleanup)

describe('read-only weekly mission command UI',()=>{
  it('shows exactly server-published agenda and dispatches one role-scoped action',async()=>{
    const select=vi.fn()
    render(<WeeklyMissionControl world={fixture()} userId={guest} onSelect={select}/>)
    const region=screen.getByRole('region',{name:'Agenda parlamentaria'})
    await within(region).findByText('Ley de prueba editorial')
    expect(within(region).getByLabelText('Progreso legislativo semanal'))
      .toHaveTextContent('1 / 1')
    expect(within(region).getByText('FIJA TU POSTURA')).toBeInTheDocument()
    fireEvent.click(within(region).getByRole('button',{name:/Abrir siguiente asunto/}))
    expect(select).toHaveBeenCalledWith('weekly-1')
    expect(mocks.calendar).toHaveBeenCalledWith('match')
    expect(mocks.parliament).toHaveBeenCalledWith('match')
  })
  it('notifies when there is no ten-article editorial release',async()=>{
    const w=fixture();w.dossiers=w.dossiers.map(d=>({...d,release_kind:'intro'}))
    mocks.calendar.mockResolvedValue({...cal,weeklyPublished:false,weeklyTotal:0})
    render(<WeeklyMissionControl world={w} userId={guest} onSelect={vi.fn()}/>)
    await screen.findByText(/Aún no se han publicado los diez asuntos/)
    expect(screen.queryByRole('button',{name:/Abrir siguiente asunto/}))
      .not.toBeInTheDocument()
  })
  it('shows current open vote as actionable without treating it as signed',async()=>{
    mocks.parliament.mockResolvedValue({
      ...parliament,bills:[{id:'bill1',match_id:'match',dossier_id:'weekly-1',
        dossier_version:1,option_id:'act',proposed_by:host,status:'open',
        rule_version:'parliament-mandates-v2',created_at:'2026-10-27',
        closes_at:'2026-10-30',closed_at:null}]
    })
    render(<WeeklyMissionControl world={fixture()} userId={guest} onSelect={vi.fn()}/>)
    await screen.findByText('TU VOTO PENDIENTE')
    expect(screen.getByLabelText('Progreso legislativo semanal'))
      .toHaveTextContent('MEDIDAS FIRMADAS0 / 1')
  })
  it('fails closed on stale calendars and temporarily unavailable parliament',async()=>{
    const select=vi.fn()
    mocks.calendar.mockResolvedValue({...cal,gameDay:'2026-10-28'})
    render(<WeeklyMissionControl world={fixture()} userId={guest} onSelect={select}/>)
    await screen.findByText(/El calendario ha cambiado/)
    expect(screen.queryByRole('button',{name:/Abrir siguiente asunto/}))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button',{name:/Ley de prueba editorial/})).toBeDisabled()
    mocks.calendar.mockResolvedValue(cal)
    mocks.parliament.mockRejectedValueOnce(new Error('API offline'))
    fireEvent.click(screen.getByRole('button',{name:'Sincronizar estado'}))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button',{name:/Abrir siguiente asunto/}))
      .not.toBeInTheDocument()
  })
  it('never makes a late signature available after the Friday deadline',async()=>{
    mocks.calendar.mockResolvedValue({...cal,gameDay:'2026-11-01'})
    const w=fixture();w.gameDay='2026-11-01'
    render(<WeeklyMissionControl world={w} userId={host} onSelect={vi.fn()}/>)
    await screen.findByText(/Semana cerrada el 2026-10-30/)
    expect(screen.getByText('PLAZO CERRADO')).toBeInTheDocument()
    expect(screen.getByRole('button',{name:/Ley de prueba editorial/})).toBeDisabled()
  })
})
