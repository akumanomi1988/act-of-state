import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PopulationPanel from './PopulationPanel'
import type { PopulationProfile } from './lib/population'

const mocked = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./lib/population', () => ({ fetchPopulationProfile: mocked.fetch }))

const sample: PopulationProfile = {
  modelVersion:'households-v1',households:300,sampleResidents:900,
  segments:[
    {dimension:'income',code:'low',households:90,residents:270,support:46,trust:53},
    {dimension:'income',code:'middle',households:150,residents:450,support:61,trust:59},
    {dimension:'income',code:'high',households:60,residents:180,support:55,trust:60},
    {dimension:'age',code:'young',households:90,residents:270,support:47,trust:60},
    {dimension:'age',code:'working',households:150,residents:450,support:59,trust:55},
    {dimension:'age',code:'senior',households:60,residents:180,support:52,trust:53}
  ]
}
beforeEach(() => { vi.clearAllMocks(); mocked.fetch.mockResolvedValue(sample) })
afterEach(cleanup)

describe('synthetic population readout', () => {
  it('makes clear these are synthetic households, not live opinion polls', async () => {
    render(<PopulationPanel governmentId="government-a" identity="user-a" />)
    expect(await screen.findByText(/300/)).toBeTruthy()
    expect(screen.getByText(/No representan a ciudadanos reales/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Explorar población'}))
    expect(screen.getByRole('heading',{name:'Ingresos bajos'})).toBeTruthy()
    expect(screen.getByRole('progressbar',{name:'Apoyo de Ingresos bajos'})
      .getAttribute('aria-valuenow')).toBe('46')
    fireEvent.click(screen.getByRole('button',{name:'Generaciones'}))
    expect(screen.getByRole('heading',{name:'Jóvenes'})).toBeTruthy()
    expect(screen.queryByRole('heading',{name:'Ingresos bajos'})).toBeNull()
  })

  it('clears data on an identity or government switch before loading the new profile', async () => {
    const { rerender } = render(<PopulationPanel governmentId="g1" identity="u1" />)
    await screen.findByText(/900/)
    mocked.fetch.mockResolvedValueOnce({...sample,households:300,sampleResidents:850})
    rerender(<PopulationPanel governmentId="g2" identity="u2" />)
    await waitFor(() => expect(mocked.fetch).toHaveBeenCalledWith('g2'))
    await screen.findByText(/850/)
  })

  it('fails closed on an authorization or network error', async () => {
    mocked.fetch.mockRejectedValue(new Error('GOVERNMENT_NOT_FOUND_OR_FORBIDDEN'))
    render(<PopulationPanel governmentId="foreign" identity="u1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido recuperar la población simulada.')
    expect(screen.queryByText(/900/)).toBeNull()
  })
})
