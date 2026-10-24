import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LivingConditionsPanel from './LivingConditionsPanel'
import { livingFixture, livingGovernmentId as gid } from './test/livingFixture'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./lib/livingConditions', async original => ({
  ...await original<typeof import('./lib/livingConditions')>(), fetchLivingConditions: mocks.fetch
}))
beforeEach(() => { mocks.fetch.mockReset(); mocks.fetch.mockResolvedValue(livingFixture()) })
afterEach(cleanup)
describe('daily social dashboard', () => {
  it('shows authoritative welfare and approval changes, income and territorial detail', async () => {
    render(<LivingConditionsPanel governmentId={gid} identity="owner" />)
    expect(await screen.findByRole('meter', { name: 'Bienestar' })).toHaveAttribute('value', '57.5')
    fireEvent.click(screen.getByRole('button', { name: 'Explorar balance social' }))
    expect(screen.getByText(/2 \/ 3 días registrados/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ingresos bajos' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toHaveTextContent('2026-10-22')
    expect(screen.getByRole('table')).not.toHaveTextContent('2026-10-23')
    fireEvent.click(screen.getByRole('button', { name: 'Por territorio' }))
    expect(screen.getByRole('heading', { name: 'Distrito Capital' })).toBeInTheDocument()
    expect(screen.getByText(/aprobación \+1 puntos/)).toBeInTheDocument()
  })
  it('loads selected windows and handles pending first measurements', async () => {
    mocks.fetch.mockImplementation(async (_id, days) => ({ ...livingFixture(gid, days),
      latest: null, expectedDays: 0, recordedDays: 0, history: [] }))
    render(<LivingConditionsPanel governmentId={gid} identity="owner" />)
    expect(await screen.findByText(/La primera medición diaria está pendiente/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Explorar balance social' }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '7' } })
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith(gid, 7))
  })
  it('retries failures without suggesting client-side simulation', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('offline'))
    render(<LivingConditionsPanel governmentId={gid} identity="owner" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se han podido recuperar')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar balance social' }))
    expect(await screen.findByRole('meter', { name: 'Bienestar' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('hides previous identity data immediately and ignores late former-account responses', async () => {
    let complete!: (value: ReturnType<typeof livingFixture>) => void
    const view = render(<LivingConditionsPanel governmentId={gid} identity="owner" />)
    await screen.findByRole('meter', { name: 'Bienestar' })
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    view.rerender(<LivingConditionsPanel governmentId={gid} identity="second" />)
    expect(screen.queryByRole('meter')).toBeNull()
    mocks.fetch.mockRejectedValueOnce(new Error('forbidden'))
    view.rerender(<LivingConditionsPanel governmentId="foreign" identity="third" />)
    await screen.findByRole('alert')
    await act(async () => complete(livingFixture()))
    expect(screen.queryByRole('meter')).toBeNull()
  })
})
