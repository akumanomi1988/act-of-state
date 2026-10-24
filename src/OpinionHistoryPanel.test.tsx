import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import OpinionHistoryPanel from './OpinionHistoryPanel'
const mocks=vi.hoisted(()=>({fetch:vi.fn()}))
vi.mock('./lib/opinionPolls',async original=>({
 ...await original<typeof import('./lib/opinionPolls')>(),
 fetchOpinionHistory:mocks.fetch
}))
vi.mock('./lib/multiplayer',()=>({
 matchError:(err:unknown)=>err instanceof Error?err.message:String(err)
}))
const mid='40000000-0000-4000-8000-000000000001'
const user='40000000-0000-4000-8000-000000000002'
const opp='40000000-0000-4000-8000-000000000003'
const snapshot=(day:string,vote:number)=>({
 day,capturedAt:day+'T00:15:00Z',modelVersion:'electoral-districts-v1',
 householdSampleSize:300,
 parties:[
  {userId:user,partyName:'Civic',seatNo:1,manifestoPolicy:50,voteSharePct:vote,seats:53},
  {userId:opp,partyName:'Green',seatNo:2,manifestoPolicy:30,voteSharePct:100-vote,seats:47}
 ],districts:[
  {code:'capital',label:'Distrito Capital',seats:25,households:75,residents:225,
   parties:[{userId:user,partyName:'Civic',voteSharePct:vote,seats:14}]}
 ]
})
const rows=[snapshot('2026-10-22',52),snapshot('2026-10-23',54)]
beforeEach(()=>{
 mocks.fetch.mockReset()
 mocks.fetch.mockResolvedValue({matchId:mid,serverDay:'2026-10-24',
  fromDay:'2026-09-25',days:30,expectedDays:30,recordedDays:2,polls:rows})
})
afterEach(cleanup)
describe('historical synthetic polling UI',()=>{
 it('renders immutable dated snapshots, trend and district breakdown',async()=>{
  render(<OpinionHistoryPanel matchId={mid} userId={user}/>)
  expect(await screen.findByText('Observatorio de intención de voto')).toBeInTheDocument()
  expect(screen.getByText('2 / 30')).toBeInTheDocument()
  expect(screen.getByText('Civic: 54.00 %')).toBeInTheDocument()
  expect(screen.getByText('+2.00 puntos desde la primera captura del periodo')).toBeInTheDocument()
  expect(screen.getByText('2026-10-22')).toBeInTheDocument()
  fireEvent.click(screen.getByText(/Distribución territorial de la última medición/))
  expect(screen.getByText('Distrito Capital')).toBeInTheDocument()
 })
 it('reloads the selected date window using the trusted backend',async()=>{
  mocks.fetch.mockImplementation(async(_id:string,days:number)=>({
   matchId:mid,serverDay:'2026-10-24',fromDay:'2026-10-18',
   days,expectedDays:7,recordedDays:0,polls:[]
  }))
  render(<OpinionHistoryPanel matchId={mid} userId={user}/>)
  fireEvent.click(screen.getByRole('radio',{name:'7 días'}))
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledWith(mid,7))
  expect(await screen.findByText(/El servidor aún no ha capturado/)).toBeInTheDocument()
 })
 it('reports access denial without leaking data',async()=>{
  mocks.fetch.mockRejectedValueOnce(new Error('MATCH_FORBIDDEN'))
  render(<OpinionHistoryPanel matchId={mid} userId={user}/>)
  expect(await screen.findByRole('alert')).toHaveTextContent('MATCH_FORBIDDEN')
  expect(screen.queryByText('Civic: 54.00 %')).toBeNull()
 })
})
