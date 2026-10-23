import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FiscalPanel from './FiscalPanel'
import type { FiscalState } from './lib/fiscal'

const mocks = vi.hoisted(() => ({ fetchFiscalState: vi.fn(), setFiscalPolicy: vi.fn() }))
vi.mock('./lib/fiscal', async (importOriginal) => ({
  ...await importOriginal<typeof import('./lib/fiscal')>(),
  fetchFiscalState: mocks.fetchFiscalState,
  setFiscalPolicy: mocks.setFiscalPolicy
}))

const governmentId = '00000000-0000-4000-8000-100000000001'
function fixture(overrides: Partial<FiscalState> = {}): FiscalState {
  return {
    governmentId,serverDay:'2026-10-23',currentWeek:'2026-10-19',
    canEdit:true,canRevise:true,
    projectedRevenueM:2375,projectedSpendingM:2420,
    policy:{
      government_id:governmentId,
      health:35,education:25,infrastructure:25,security:15,tax_rate:25,
      revised_this_week:false,revision_week:'2026-10-19',
      updated_at:'2026-10-23T00:00:00Z'
    },
    indicators:{
      treasuryM:12000,debtM:0,gdpIndex:100,unemploymentBp:700,
      inflationBp:250,approval:50,trust:50
    },
    history:[],...overrides
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchFiscalState.mockResolvedValue(fixture())
  mocks.setFiscalPolicy.mockResolvedValue(fixture().policy)
})
afterEach(cleanup)

describe('FiscalPanel: one server-authoritative policy per week', () => {
  it('shows persisted public accounts, macro indicators and correctly summed allocations', async () => {
    render(<FiscalPanel governmentId={governmentId}/>)
    expect(await screen.findByText('Presupuesto del Estado')).toBeInTheDocument()
    expect(await screen.findByText('2.375 M€')).toBeInTheDocument()
    expect(screen.getByText('2.420 M€')).toBeInTheDocument()
    expect(screen.getByText('-45 M€')).toBeInTheDocument()
    expect(screen.getByRole('progressbar',{name:'Sanidad'})).toHaveAttribute('aria-valuenow','35')
    expect(screen.getByRole('progressbar',{name:'Seguridad'})).toHaveAttribute('aria-valuenow','15')
    expect(mocks.setFiscalPolicy).not.toHaveBeenCalled()
  })
  it('requires explicit review before submitting an allocation that preserves 100 percent', async () => {
    const revised = fixture({
      canRevise:false,projectedRevenueM:2565,projectedSpendingM:2460,
      policy:{...fixture().policy,health:40,security:10,tax_rate:27,revised_this_week:true}
    })
    mocks.fetchFiscalState.mockResolvedValueOnce(fixture()).mockResolvedValueOnce(revised)
    render(<FiscalPanel governmentId={governmentId}/>)
    expect(await screen.findByText('Presupuesto del Estado')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Partida de origen'),{target:{value:'security'}})
    fireEvent.change(screen.getByLabelText('Partida de destino'),{target:{value:'health'}})
    fireEvent.change(screen.getByLabelText('Nuevo tipo fiscal'),{target:{value:'27'}})
    expect(mocks.setFiscalPolicy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Revisar nueva distribución'}))
    expect(screen.getByText(/fiscalidad 27%/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Aprobar presupuesto semanal'}))
    await waitFor(() => expect(mocks.setFiscalPolicy).toHaveBeenCalledWith(governmentId,
      {health:40,education:25,infrastructure:25,security:10,tax_rate:27}))
    expect(await screen.findByText(/Presupuesto registrado para la semana actual/)).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Aprobar presupuesto semanal'})).not.toBeInTheDocument()
  })
  it('rejects transfers below the statutory sector minimum', async () => {
    render(<FiscalPanel governmentId={governmentId}/>)
    await screen.findByText('Presupuesto del Estado')
    fireEvent.change(screen.getByLabelText('Puntos a trasladar'),{target:{value:'8'}})
    expect(screen.getByRole('button',{name:'Revisar nueva distribución'})).toBeDisabled()
    expect(screen.getByText(/límites legales/)).toBeInTheDocument()
  })
  it('does not offer controls to opposition', async () => {
    mocks.fetchFiscalState.mockResolvedValue(fixture({canEdit:false}))
    render(<FiscalPanel governmentId={governmentId}/>)
    await screen.findByText('Presupuesto del Estado')
    expect(screen.queryByLabelText('Partida de origen')).not.toBeInTheDocument()
    expect(screen.getByText(/solo el gobierno puede redistribuir/)).toBeInTheDocument()
    expect(mocks.setFiscalPolicy).not.toHaveBeenCalled()
  })
  it('exposes authorization errors and never displays invented fiscal data', async () => {
    mocks.fetchFiscalState.mockRejectedValue(new Error('FISCAL_FORBIDDEN'))
    render(<FiscalPanel governmentId={governmentId}/>)
    expect(await screen.findByRole('alert')).toHaveTextContent('FISCAL_FORBIDDEN')
    expect(screen.getByRole('status')).toHaveTextContent('No se ha podido cargar')
    expect(screen.queryByText('2.375 M€')).not.toBeInTheDocument()
  })
  it('shows dated immutable server settlement acts', async () => {
    const act = {
      government_id:governmentId,week_start:'2026-10-12',
      settled_at:'2026-10-17T00:01:00Z',
      engine_version:'national-fiscal-v1' as const,policy_snapshot:{tax_rate:25},
      revenue_m_eur:2375,spending_m_eur:2420,balance_m_eur:-45,
      debt_issued_m_eur:0,debt_repaid_m_eur:0,treasury_after_m_eur:11955,
      debt_after_m_eur:0,gdp_index_after:100,unemployment_bp_after:700,
      inflation_bp_after:250
    }
    mocks.fetchFiscalState.mockResolvedValue(fixture({history:[act]}))
    render(<FiscalPanel governmentId={governmentId}/>)
    expect(await screen.findByText('Semana del 2026-10-12')).toBeInTheDocument()
    expect(screen.getAllByText('-45 M€').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Tesorería 11.955 M€/)).toBeInTheDocument()
  })
})
