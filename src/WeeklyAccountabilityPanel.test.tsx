import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import WeeklyAccountabilityPanel from './WeeklyAccountabilityPanel'
const mocked=vi.hoisted(()=>({fetch:vi.fn()}))
vi.mock('./lib/weeklyAccountability',()=>({fetchWeeklyAccountability:mocked.fetch}))
vi.mock('./lib/multiplayer',()=>({matchError:(e:unknown)=>String(e)}))
const id='20000000-0000-4000-8000-000000000020'
const history={
 serverDay:'2026-10-24',
 weeks:[
  {weekStart:'2026-10-19',friday:'2026-10-23',status:'live',published:false,
   dossiers:[],parties:[{seatNo:1,partyName:'Civic Front',positions:0,votes:0}],
   fridayAct:null,elections:[]},
  {weekStart:'2026-10-12',friday:'2026-10-16',status:'closed',published:true,
   dossiers:[{id:'climate-1',title:'Climate adaptation plan',
    category:'Economía',sourceTitle:'Journalist source',
    sourceUrl:'https://example.org/news',
    positions:2,decision:{optionId:'green-grant',decidedOn:'2026-10-14',
     treasuryDelta:-400,approval:'60',trust:'55'},
    bill:{status:'passed',closesAt:'2026-10-15T12:00:00Z',
     yesVotes:3,noVotes:1,abstentions:0}}],
   parties:[{seatNo:1,partyName:'Civic Front',positions:1,votes:1}],
   fridayAct:{week_start:'2026-10-12',dossiers_published:1,
    decisions_resolved:1,treasury_delta_m_eur:-400,
    treasury_at_friday_m_eur:11600,approval_at_friday:60,trust_at_friday:55},
   elections:[{certifiedOn:'2026-10-16',electionNo:1,winnerParty:'Civic Front'}]}
 ]
}
beforeEach(()=>{vi.resetAllMocks();mocked.fetch.mockResolvedValue(history)})
afterEach(cleanup)
describe('weekly parliamentary accountability',()=>{
 it('shows no fictitious news while a week is unpublished',async()=>{
  render(<WeeklyAccountabilityPanel matchId={id}/>)
  expect(await screen.findByText(/No se ha publicado ninguna agenda/)).toBeInTheDocument()
  expect(screen.queryByText('Climate adaptation plan')).toBeNull()
  expect(mocked.fetch).toHaveBeenCalledWith(id)
 })
 it('recovers historical Friday decisions, party votes, source and election',async()=>{
  render(<WeeklyAccountabilityPanel matchId={id}/>)
  await screen.findByText(/No se ha publicado ninguna agenda/)
  fireEvent.change(screen.getByRole('combobox',{name:'Semana política'}),{
   target:{value:'2026-10-12'}
  })
  expect(screen.getByText('Climate adaptation plan')).toBeInTheDocument()
  expect(screen.getByText(/Acta oficial del viernes/)).toBeInTheDocument()
  expect(screen.getByText(/nuevo gobierno:/)).toBeInTheDocument()
  expect(screen.getByRole('link',{name:'Fuente: Journalist source'}))
   .toHaveAttribute('href','https://example.org/news')
  expect(screen.getByText(/3 sí \/ 1 no/)).toBeInTheDocument()
 })
 it('signals a failed API read rather than inventing a historical timeline',async()=>{
  mocked.fetch.mockRejectedValue(new Error('MATCH_FORBIDDEN'))
  render(<WeeklyAccountabilityPanel matchId={id}/>)
  await waitFor(()=>expect(screen.getByRole('alert'))
   .toHaveTextContent('MATCH_FORBIDDEN'))
  expect(screen.queryByText('Climate adaptation plan')).toBeNull()
 })
})
