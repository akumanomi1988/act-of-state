import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AuthGateway from './AuthGateway'

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  resetPasswordForEmail: vi.fn()
}))
vi.mock('./lib/game', () => ({
  client: { auth: mocks },
  friendlyError: (reason: unknown) => reason instanceof Error ? reason.message : String(reason)
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.signInWithPassword.mockResolvedValue({ data: { session: { access_token: 'signed' } }, error: null })
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null })
  mocks.signInWithOtp.mockResolvedValue({ error: null })
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null })
})
afterEach(cleanup)

function email(value = ' Player@Example.COM ') {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value } })
}
function password(value: string) {
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value } })
}

describe('shared account access', () => {
  it('uses password authentication directly, with no email request', async () => {
    render(<AuthGateway redirectTo="https://game.example/multiplayer" />)
    email()
    password('an existing password')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'Player@Example.COM', password: 'an existing password'
    }))
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('rejects mismatched passwords without sending a signup and sends one-time verification if needed', async () => {
    render(<AuthGateway redirectTo="https://game.example/" />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    email('new@example.com')
    password('long-secure-passphrase')
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'different-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cuenta' }))
    expect(mocks.signUp).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('coincidir')
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'long-secure-passphrase' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cuenta' }))
    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'new@example.com', password: 'long-secure-passphrase',
      options: { emailRedirectTo: 'https://game.example/' }
    }))
    expect(screen.getByRole('status')).toHaveTextContent('confirmación')
  })

  it('refuses a weak signup password without contacting the server', () => {
    render(<AuthGateway redirectTo="https://game.example/" />)
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    email('new@example.com')
    password('short')
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'short' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar cuenta' }).closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('12 caracteres')
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('keeps link access only as an opt-in recovery path for existing accounts', async () => {
    render(<AuthGateway redirectTo="https://game.example/multiplayer?invite=abc" />)
    fireEvent.click(screen.getByRole('button', { name: 'Acceder por correo' }))
    email('legacy@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    await waitFor(() => expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: 'legacy@example.com',
      options: {
        emailRedirectTo: 'https://game.example/multiplayer?invite=abc',
        shouldCreateUser: false
      }
    }))
    expect(mocks.signUp).not.toHaveBeenCalled()
  })

  it('requests a reset without disclosing whether an account exists', async () => {
    render(<AuthGateway redirectTo="https://game.example/editorial" />)
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar contraseña' }))
    email('person@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar recuperación' }))
    await waitFor(() => expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'person@example.com', { redirectTo: 'https://game.example/editorial' }))
    expect(screen.getByRole('status')).toHaveTextContent('Si la cuenta existe')
  })

  it('shows authentication failures without claiming login succeeded', async () => {
    mocks.signInWithPassword.mockResolvedValue({ data: { session: null }, error: new Error('Invalid login credentials') })
    render(<AuthGateway redirectTo="https://game.example/" />)
    email('user@example.com')
    password('incorrect')
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    expect(screen.queryByRole('status')).toBeNull()
  })
})
