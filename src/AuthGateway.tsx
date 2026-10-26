import { useId, useState, type FormEvent } from 'react'
import { client, friendlyError } from './lib/game'

type AccessMode = 'login' | 'register' | 'magic' | 'reset'

const modeLabels: Record<AccessMode, string> = {
  login: 'Entrar con contraseña',
  register: 'Crear cuenta',
  magic: 'Acceder por correo',
  reset: 'Recuperar contraseña'
}

/** One entrypoint for solo, multiplayer and editorial: the server owns identity. */
export default function AuthGateway({ redirectTo }: { redirectTo: string }) {
  const id = useId()
  const [mode, setMode] = useState<AccessMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  function choose(next: AccessMode) {
    if (pending) return
    setMode(next)
    setPassword('')
    setConfirmation('')
    setError('')
    setNotice('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || pending) return
    if (mode === 'register' && (password.length < 12 || password !== confirmation)) {
      setError('La contraseña debe tener al menos 12 caracteres y coincidir con la confirmación.')
      return
    }
    setPending(true)
    setError('')
    setNotice('')
    try {
      const address = email.trim()
      if (mode === 'login') {
        const { data, error: authError } = await client.auth.signInWithPassword({
          email: address, password
        })
        if (authError) throw authError
        if (!data.session) throw new Error('El servidor no ha confirmado la sesión.')
        setPassword('')
      } else if (mode === 'register') {
        const { data, error: authError } = await client.auth.signUp({
          email: address, password, options: { emailRedirectTo: redirectTo }
        })
        if (authError) throw authError
        setPassword('')
        setConfirmation('')
        if (!data.session) setNotice('Si es necesario validar la cuenta, recibirás un único correo de confirmación. Después entrarás con tu contraseña.')
      } else if (mode === 'magic') {
        const { error: authError } = await client.auth.signInWithOtp({
          email: address,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false }
        })
        if (authError) throw authError
        setNotice('Si la cuenta existe, recibirás un enlace de acceso. Después podrás establecer una contraseña.')
      } else {
        const { error: authError } = await client.auth.resetPasswordForEmail(address, {
          redirectTo
        })
        if (authError) throw authError
        setNotice('Si la cuenta existe, recibirás instrucciones para establecer una contraseña.')
      }
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setPending(false)
    }
  }

  return <div className="auth-gateway">
    <div className="auth-modes" role="group" aria-label="Método de acceso">
      {(['login', 'register', 'magic', 'reset'] as const).map(value =>
        <button key={value} type="button" aria-pressed={mode === value}
          disabled={pending} onClick={() => choose(value)}>{modeLabels[value]}</button>)}
    </div>
    <p className="auth-explainer">
      {mode === 'login' ? 'Entra sin esperar un correo en cada sesión.' :
        mode === 'register' ? 'Regístrate con contraseña. Puede ser necesaria una única confirmación del correo.' :
        mode === 'magic' ? 'Para cuentas antiguas sin contraseña. Tras entrar, configúrala desde Seguridad de la cuenta.' :
        'Recibirás un único enlace para recuperar tu contraseña.'}
    </p>
    <form className="auth-form" onSubmit={event => void submit(event)}>
      <label htmlFor={id + '-email'}>Correo electrónico</label>
      <input id={id + '-email'} type="email" autoComplete="email" required maxLength={254}
        value={email} onChange={event => setEmail(event.target.value)}
        placeholder="tu@correo.es" disabled={pending} />
      {(mode === 'login' || mode === 'register') && <>
        <label htmlFor={id + '-password'}>Contraseña</label>
        <input id={id + '-password'} type="password" required
          minLength={mode === 'register' ? 12 : undefined} maxLength={128}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          value={password} onChange={event => setPassword(event.target.value)}
          disabled={pending} />
      </>}
      {mode === 'register' && <>
        <label htmlFor={id + '-confirm'}>Confirmar contraseña</label>
        <input id={id + '-confirm'} type="password" autoComplete="new-password"
          minLength={12} maxLength={128} required disabled={pending}
          value={confirmation} onChange={event => setConfirmation(event.target.value)} />
      </>}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? 'Comprobando…' : modeLabels[mode]}
      </button>
    </form>
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>
}
