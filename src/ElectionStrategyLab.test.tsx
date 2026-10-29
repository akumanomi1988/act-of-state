import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest'
import ElectionStrategyLab from './ElectionStrategyLab'
import type {ElectionProjection,StrategyPreview} from './lib/elections'

const mocks=vi.hoisted(()=>({forecast:vi.fn()}))
vi.mock('./lib/elections',()=>({fetchStrategyPreview:mocks.forecast}))
const me='00000000-0000-4000-8000-000000000001'
const other='00000000-0000-4000-8000-000000000002'
const codes=[
 ['capital',25,14],['industrial',20,11],['coastal',18,10],
 ['agrarian',15,8],['highland',12,6],['frontier',10,5]
] as const
const projection:ElectionProjection={
 modelVersion:'electoral-districts-v2',householdSampleSize:300,
 parties:[
  {userId:me,seatNo:1,partyName:'Progress',manifestoPolicy:50,
   voteSharePct:54,seats:54,campaignInfluenceTotal:3},
  {userId:other,seatNo:2,partyName:'Reform',manifestoPolicy:40,
   voteSharePct:46,seats:46,campaignInfluenceTotal:2}
 ],
 cohorts:[{code:'households',weight:100,idealPolicy:25,support:50,trust:50}],
 districts:codes.map(([code,seats,mine])=>({
  code,label:code,seats,households:50,residents:125,
  parties:[{userId:me,partyName:'Progress',voteSharePct:54,seats:mine},
   {userId:other,partyName:'Reform',voteSharePct:46,seats:seats-mine}]
 }))
}
const revisedSeats=[13,10,10,8,6,4]
const hypothetical:ElectionProjection={
 ...projection,parties:[
  {...projection.parties[0],manifestoPolicy:75,voteSharePct:51,seats:51},
  {...projection.parties[1],voteSharePct:49,seats:49}
 ],
 districts:projection.districts?.map((d,i)=>({...d,parties:[
  {...d.parties[0],seats:revisedSeats[i]},
  {...d.parties[1],seats:d.seats-revisedSeats[i]}
 ]}))
}
const forecast:StrategyPreview={
 modelVersion:'electoral-strategy-v1',matchId:'m1',playerId:me,
 serverDay:'2026-10-28',proposedPolicy:75,committed:false,
 current:projection,hypothetical
}
const props={matchId:'m1',userId:me,policy:75,projection,
 serverDay:'2026-10-28',active:true,campaignOpen:true}
beforeEach(()=>{mocks.forecast.mockReset();mocks.forecast.mockResolvedValue(forecast)})
afterEach(cleanup)

describe('in-game read-only electoral scenario workshop',()=>{
 it('compares current and hypothetical voting without publishing a programme',async()=>{
  render(<ElectionStrategyLab {...props}/>)
  fireEvent.click(screen.getByText(/Proyección electoral/))
  fireEvent.click(screen.getByRole('button',{name:'Calcular proyección'}))
  await waitFor(()=>expect(mocks.forecast).toHaveBeenCalledWith('m1',me,75))
  expect(await screen.findByText(/54.00% \/ 51.00%/)).toBeInTheDocument()
  expect(screen.getByText(/54 \/ 51/)).toBeInTheDocument()
  expect(screen.getByText(/-3 escaños/)).toBeInTheDocument()
  expect(screen.getByText(/modelo electoral vigente/)).toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Publicar programa'})).toBeNull()
 })
 it('cannot execute during the reflection week or in a lobby',()=>{
  const {rerender}=render(<ElectionStrategyLab {...props} campaignOpen={false}/>)
  fireEvent.click(screen.getByText(/Proyección electoral/))
  expect(screen.getByRole('button',{name:'Calcular proyección'})).toBeDisabled()
  rerender(<ElectionStrategyLab {...props} active={false}/>)
  expect(screen.getByRole('button',{name:'Calcular proyección'})).toBeDisabled()
  expect(mocks.forecast).not.toHaveBeenCalled()
 })
 it('discards an in-flight preview when player changes match',async()=>{
  let settle!: (v:StrategyPreview)=>void
  mocks.forecast.mockReturnValueOnce(new Promise<StrategyPreview>(resolve=>{settle=resolve}))
  const {rerender}=render(<ElectionStrategyLab {...props}/>)
  fireEvent.click(screen.getByText(/Proyección electoral/))
  fireEvent.click(screen.getByRole('button',{name:'Calcular proyección'}))
  await waitFor(()=>expect(mocks.forecast).toHaveBeenCalledTimes(1))
  rerender(<ElectionStrategyLab {...props} matchId="m2" policy={25}/>)
  await act(async()=>{settle(forecast)})
  expect(screen.queryByText(/54.00% \/ 51.00%/)).toBeNull()
  expect(screen.getByText(/Programa propuesto:/)).toHaveTextContent('25/100')
 })
 it('never shows an invented forecast after a server rejection',async()=>{
  mocks.forecast.mockRejectedValueOnce(new Error('STRATEGY_CAMPAIGN_CLOSED'))
  render(<ElectionStrategyLab {...props}/>)
  fireEvent.click(screen.getByText(/Proyección electoral/))
  fireEvent.click(screen.getByRole('button',{name:'Calcular proyección'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo calcular')
  expect(screen.queryByText(/54.00% \/ 51.00%/)).toBeNull()
 })
})
