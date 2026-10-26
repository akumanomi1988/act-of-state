import { useState, type FormEvent } from 'react'
import { client } from './lib/game'
import { MIN_PASSWORD_LENGTH, newPasswordIssue, normalizeEmail } from './lib/passwordPolicy'
import type {PublicLanguage} from './lib/publicLanguage'
import './PasswordAccess.css'

type PasswordSignInProps = {
  email: string
  onEmailChange(email: string): void
  onError(message: string): void
  redirectTo: string
  disabled?: boolean
  language?: PublicLanguage
}

/** Password auth is tied to the same Supabase user id as the existing OTP flow. */
export function PasswordSignIn({
  email, onEmailChange, onError, redirectTo, disabled = false, language='es'
}: PasswordSignInProps) {
  const t=(es:string,en:string)=>language==='en'?en:es
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
        onError(t('No se ha podido iniciar sesión. Revisa el correo y la contraseña. Si aún no has creado una contraseña, accede una vez mediante enlace.','Sign-in failed. Check your email and password. If you have not configured a password, sign in once by email link.'))
      }
    } catch {
      onError(t('El acceso no está disponible. Comprueba tu conexión e inténtalo de nuevo.','Sign-in is unavailable. Check your connection and retry.'))
    } finally {
      setPassword('')
      setBusy(false)
    }
  }

  async function recoverPassword() {
    if (blocked || !client) return
    const normalized = normalizeEmail(email)
    if (!normalized) {
      onError(t('Introduce primero tu correo electrónico para recuperar el acceso.','Enter your email address to request account recovery.'))
      return
    }
    setBusy(true)
    onError('')
    try {
      const { error } = await client.auth.resetPasswordForEmail(normalized, {
        redirectTo
      })
      if (error) {
        onError(t('No se ha podido solicitar la recuperación en este momento.','Unable to request password recovery right now.'))
      } else {
        setNotice(t('Si existe una cuenta con ese correo, recibirás instrucciones de recuperación.','If an account exists with that address, recovery instructions will be sent.'))
      }
    } catch {
      onError(t('No se ha podido contactar con el servicio de recuperación.','Unable to reach the password recovery service.'))
    } finally {
      setBusy(false)
    }
  }

  return <div className="password-signin">
    <h3>{t('Entrar sin esperar un correo','Sign in without waiting for email')}</h3>
    <form onSubmit={event => void signIn(event)}>
      <label>{t('Correo para contraseña','Account email')}
        <input type="email" autoComplete="email" required value={email}
          disabled={blocked} onChange={event => onEmailChange(event.target.value)} />
      </label>
      <label>{t('Contraseña','Password')}
        <input type="password" autoComplete="current-password" required
          value={password} disabled={blocked}
          onChange={event => setPassword(event.target.value)} />
      </label>
      <button type="submit" disabled={blocked}>
        {busy ? t('Accediendo…','Signing in…') : t('Entrar con contraseña','Sign in with password')}
      </button>
    </form>
    <button type="button" className="text-button" disabled={blocked}
      onClick={() => void recoverPassword()}>{t('He olvidado mi contraseña','Forgot password')}</button>
    {notice && <p className="success" role="status">{notice}</p>}
  </div>
}

/** Existing magic-link users add a password to their OWN verified identity. */
export function AccountPasswordPanel({language='es'}:{language?:PublicLanguage}={}) {
  const t=(es:string,en:string)=>language==='en'?en:es
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
      setError(language==='en'?issue.includes('12')?'Use a password of at least 12 characters.':'Passwords do not match.':issue)
      return
    }
    setBusy(true)
    try {
      const { error: authError } = await client.auth.updateUser({ password })
      if (authError) {
        setError(t('No se ha podido establecer la contraseña. Es posible que Supabase requiera que vuelvas a verificar tu sesión mediante un enlace.','Could not set your password. Your account provider may require you to verify your session again using an email link.'))
      } else {
        setSuccess(true)
      }
    } catch {
      setError(t('No se ha podido actualizar tu cuenta. Inténtalo de nuevo más tarde.','Could not update your account. Please retry later.'))
    } finally {
      setPassword('')
      setConfirmation('')
      setBusy(false)
    }
  }

  return <details className="account-password-panel">
    <summary>{t('Configurar contraseña de acceso','Set up password access')}</summary>
    <p>{t('Si normalmente accedes mediante un enlace, configura una contraseña una sola vez. Seguirás usando la misma cuenta, tu gobierno y tus partidas.','If you usually sign in using an email link, configure a password once. Your account, government and matches remain unchanged.')}</p>
    <form onSubmit={event => void savePassword(event)}>
      <label>{t('Nueva contraseña','New password')}
        <input type="password" autoComplete="new-password" required
          minLength={MIN_PASSWORD_LENGTH} disabled={busy} value={password}
          onChange={event => setPassword(event.target.value)} />
      </label>
      <label>{t('Repite la contraseña','Repeat password')}
        <input type="password" autoComplete="new-password" required
          minLength={MIN_PASSWORD_LENGTH} disabled={busy} value={confirmation}
          onChange={event => setConfirmation(event.target.value)} />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? t('Guardando…','Saving…') : t('Guardar contraseña','Save password')}
      </button>
    </form>
    {error && <p role="alert">{error}</p>}
    {success && <p role="status" className="success">
      {t('Contraseña guardada. La próxima vez podrás entrar sin recibir un correo.','Password saved. Next time you can sign in without waiting for an email.')}
    </p>}
  </details>
}
