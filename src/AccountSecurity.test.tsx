import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountSecurity from './AccountSecurity'

const mocks = vi.hoisted(() => ({ updateUser: vi.fn() }))
vi.mock('./lib/game', () => ({
  client: { auth: mocks },
  friendlyError: (reason: unknown) => reason instanceof Error ? reason.message : String(reason)
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.updateUser.mockResolvedValue({ data: { user: { id: 'actor-1' } }, error: null })
})
afterEach(cleanup)

function setPasswords(first: string, second: string) {
  fireEvent.change(screen.getByLabelText('Contraseña nueva (mínimo 12 caracteres)'),
    { target: { value: first } })
  fireEvent.change(screen.getByLabelText('Repetir contraseña nueva'),
    { target: { value: second } })
}

describe('signed-in password setup', () => {
  it('upgrades a magic-link session to password login without requesting another email', async () => {
    const onRecovered = vi.fn()
    render(<AccountSecurity recovering onRecovered={onRecovered} />)
    expect(screen.getByText(/recuperar tu acceso/)).toBeInTheDocument()
    setPasswords('long-enough-passphrase', 'long-enough-passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({
      password: 'long-enough-passphrase'
    }))
    expect(onRecovered).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Ya puedes entrar sin solicitar un enlace')
  })

  it('does not transmit mismatched credentials and clears them when closed', () => {
    render(<AccountSecurity />)
    fireEvent.click(screen.getByRole('button', { name: /Seguridad de la cuenta/ }))
    setPasswords('long-enough-passphrase', 'different-long-passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('coincidir')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar seguridad de la cuenta' }))
    fireEvent.click(screen.getByRole('button', { name: /Seguridad de la cuenta/ }))
    expect(screen.getByLabelText('Contraseña nueva (mínimo 12 caracteres)')).toHaveValue('')
  })

  it('does not claim success when security policy rejects the change', async () => {
    mocks.updateUser.mockResolvedValue({ data: { user: null }, error: new Error('Reauthentication required') })
    render(<AccountSecurity recovering />)
    setPasswords('long-enough-passphrase', 'long-enough-passphrase')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Reauthentication required')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
