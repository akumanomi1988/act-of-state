import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import MandateObservatory from './MandateObservatory'

const mocks=vi.hoisted(()=>({
  fiscal:vi.fn(),living:vi.fn(),opinion:vi.fn(),election:vi.fn()
}))
vi.mock('./lib/fiscal',()=>({fetchFiscalState:mocks.fiscal}))
vi.mock('./lib/livingConditions',()=>({fetchLivingConditions:mocks.living}))
vi.mock('./lib/opinionPolls',()=>({fetchOpinionHistory:mocks.opinion}))
vi.mock('./lib/elections',()=>({fetchElectionState:mocks.election}))
const gov='62000000-0000-4000-8000-000000000001'
const who='62000000-0000-4000-8000-000000000002'
const match='62000000-0000-4000-8000-000000000003'
const record=(date:string,wellbeing:number)=>({
  day:date,capturedAt:date+'T03:00:00Z',modelVersion:'living-conditions-v1',
  summary:{wellbeing,economicSecurity:55,serviceAccess:50}
})
beforeEach(()=>{
  Object.values(mocks).forEach(fn=>fn.mockReset())
  mocks.fiscal.mockResolvedValue({
    governmentId:gov,serverDay:'2026-10-26',projectedRevenueM:2000,
    projectedSpendingM:2400,indicators:{treasuryM:800,debtM:1900},
    history:[{week_start:'2026-10-19',balance_m_eur:-400,debt_issued_m_eur:20}]
  })
  mocks.living.mockImplementation(async (_gov:string,days:number)=>({
    governmentId:gov,serverDay:'2026-10-26',days,
    expectedDays:3,recordedDays:2,
    history:[record('2026-10-24',45),record('2026-10-26',37)]
  }))
  mocks.opinion.mockResolvedValue({
    matchId:match,serverDay:'2026-10-26',expectedDays:3,
    polls:[
      {day:'2026-10-24',parties:[{userId:who,voteSharePct:52,seats:56}]},
      {day:'2026-10-26',parties:[{userId:who,voteSharePct:47,seats:49}]}
    ]
  })
  mocks.election.mockResolvedValue({serverDay:'2026-10-26',
    history:[{certified_on:'2026-10-25',winner_user_id:who}]})
})
afterEach(cleanup)

describe('strategic mandate observatory UI and account isolation',()=>{
  it('does not fetch while collapsed; opens actual fiscal, social and stress diagnostics',async()=>{
    render(<MandateObservatory governmentId={gov} identity={who}/>)
    expect(mocks.fiscal).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Analizar mandato'}))
    const panel=screen.getByRole('region',{name:'Observatorio estratégico del mandato'})
    expect(await within(panel).findByText('Resistencia presupuestaria')).toBeInTheDocument()
    expect(within(panel).getByText('Actas sociales:',{exact:false})).toBeInTheDocument()
  })
  it('keeps true missing-day counts, distinguishes hypothetical scenarios and switches range',async()=>{
    render(<MandateObservatory governmentId={gov} identity={who}/>)
    fireEvent.click(screen.getByRole('button',{name:'Analizar mandato'}))
    const panel=screen.getByRole('region',{name:'Observatorio estratégico del mandato'})
    expect(await within(panel).findByText('Ingresos un 10 % menores')).toBeInTheDocument()
    expect(within(panel).getByText(/Faltan actas diarias/)).toBeInTheDocument()
    expect(within(panel).getByText(/El presupuesto semanal vigente tiene déficit/)).not.toBeNull()
    fireEvent.click(within(panel).getByRole('radio',{name:'90 días'}))
    await waitFor(()=>expect(mocks.living).toHaveBeenCalledWith(gov,90))
    await within(panel).findByText('Peor bienestar observado:',{exact:false})
    expect(within(panel).getByText(/2 \/ 3/)).toBeInTheDocument()
  })
  it('shows the signed-in party polling sample and certified elections, not mock certification',async()=>{
    render(<MandateObservatory governmentId={gov} identity={who} matchId={match}/>)
    fireEvent.click(screen.getByRole('button',{name:'Analizar mandato'}))
    const panel=screen.getByRole('region',{name:'Observatorio estratégico del mandato'})
    expect(await within(panel).findByText('47 %')).toBeInTheDocument()
    expect(within(panel).getByText('-5 puntos',{exact:false})).toBeInTheDocument()
    expect(within(panel).getByText(/Elecciones certificadas en el periodo/)).toHaveTextContent('1')
    expect(mocks.opinion).toHaveBeenCalledWith(match,30)
  })
  it('retains readable partial evidence when an upstream read fails',async()=>{
    mocks.fiscal.mockRejectedValue(new Error('FISCAL_FORBIDDEN'))
    render(<MandateObservatory governmentId={gov} identity={who}/>)
    fireEvent.click(screen.getByRole('button',{name:'Analizar mandato'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron recuperar las actas fiscales.')
    const panel=screen.getByRole('region',{name:'Observatorio estratégico del mandato'})
    expect(within(panel).getByText('37 / 100')).toBeInTheDocument()
    expect(within(panel).queryByText('Ingresos un 10 % menores')).toBeNull()
  })
})
