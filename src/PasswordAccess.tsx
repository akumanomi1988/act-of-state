import { useState, type FormEvent } from 'react'
import { client } from './lib/game'
import { MIN_PASSWORD_LENGTH, newPasswordIssue, normalizeEmail } from './lib/passwordPolicy'
import './PasswordAccess.css'

type PasswordSignInProps = {
  email: string
  onEmailChange(email: string): void
  onError(message: string): void
  redirectTo: string
  disabled?: boolean
}

/** Password auth is tied to the same Supabase user id as the existing OTP flow. */
export function PasswordSignIn({
  email, onEmailChange, onError, redirectTo, disabled = false
}: PasswordSignInProps) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const blocked = busy || disabled

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked || !client) return
    const normalized = normalizeEmail(email)
    if (!normalized || !password) return
    setBusy(true)
    setNotice('')
    onError('')
    try {
      const { error } = await client.auth.signInWithPassword({
        email: normalized, password
      })
      if (error) {
        onError('No se ha podido iniciar sesión. Revisa el correo y la contraseña. Si aún no has creado una contraseña, accede una vez mediante enlace.')
      }
    } catch {
      onError('El acceso no está disponible. Comprueba tu conexión e inténtalo de nuevo.')
    } finally {
      setPassword('')
      setBusy(false)
    }
  }

  async function recoverPassword() {
    if (blocked || !client) return
    const normalized = normalizeEmail(email)
    if (!normalized) {
      onError('Introduce primero tu correo electrónico para recuperar el acceso.')
      return
    }
    setBusy(true)
    onError('')
    try {
      const { error } = await client.auth.resetPasswordForEmail(normalized, {
        redirectTo
      })
      if (error) {
        onError('No se ha podido solicitar la recuperación en este momento.')
      } else {
        setNotice('Si existe una cuenta con ese correo, recibirás instrucciones de recuperación.')
      }
    } catch {
      onError('No se ha podido contactar con el servicio de recuperación.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="password-signin">
    <h3>Entrar sin esperar un correo</h3>
    <form onSubmit={event => void signIn(event)}>
      <label>Correo electrónico
        <input type="email" autoComplete="email" required value={email}
          disabled={blocked} onChange={event => onEmailChange(event.target.value)} />
      </label>
      <label>Contraseña
        <input type="password" autoComplete="current-password" required
          value={password} disabled={blocked}
          onChange={event => setPassword(event.target.value)} />
      </label>
      <button type="submit" disabled={blocked}>
        {busy ? 'Accediendo…' : 'Entrar con contraseña'}
      </button>
    </form>
    <button type="button" className="text-button" disabled={blocked}
      onClick={() => void recoverPassword()}>He olvidado mi contraseña</button>
    {notice && <p className="success" role="status">{notice}</p>}
  </div>
}

/** Existing magic-link users add a password to their OWN verified identity. */
export function AccountPasswordPanel() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !client) return
    setError('')
    setSuccess(false)
    const issue = newPasswordIssue(password, confirmation)
    if (issue) {
      setError(issue)
      return
    }
    setBusy(true)
    try {
      const { error: authError } = await client.auth.updateUser({ password })
      if (authError) {
        setError('No se ha podido establecer la contraseña. Es posible que Supabase requiera que vuelvas a verificar tu sesión mediante un enlace.')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('No se ha podido actualizar tu cuenta. Inténtalo de nuevo más tarde.')
    } finally {
      setPassword('')
      setConfirmation('')
      setBusy(false)
    }
  }

  return <details className="account-password-panel">
    <summary>Configurar contraseña de acceso</summary>
    <p>Si normalmente accedes mediante un enlace, configura una contraseña una sola vez.
      Seguirás usando la misma cuenta, tu gobierno y tus partidas.</p>
    <form onSubmit={event => void savePassword(event)}>
      <label>Nueva contraseña
        <input type="password" autoComplete="new-password" required
          minLength={MIN_PASSWORD_LENGTH} disabled={busy} value={password}
          onChange={event => setPassword(event.target.value)} />
      </label>
      <label>Repite la contraseña
        <input type="password" autoComplete="new-password" required
          minLength={MIN_PASSWORD_LENGTH} disabled={busy} value={confirmation}
          onChange={event => setConfirmation(event.target.value)} />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
    {error && <p role="alert">{error}</p>}
    {success && <p role="status" className="success">
      Contraseña guardada. La próxima vez podrás entrar sin recibir un correo.
    </p>}
  </details>
}
