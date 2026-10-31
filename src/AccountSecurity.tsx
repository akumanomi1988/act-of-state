import { useEffect, useId, useState, type FormEvent } from 'react'
import { client, friendlyError } from './lib/game'

/** Converts an already authenticated email-link account into password access. */
export default function AccountSecurity({
  recovering = false, onRecovered
}: { recovering?: boolean; onRecovered?: () => void }) {
  const id = useId()
  const [open, setOpen] = useState(recovering)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { if (recovering) setOpen(true) }, [recovering])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || pending) return
    if (password.length < 12 || password !== confirmation) {
      setError('La contraseña debe tener al menos 12 caracteres y coincidir con la confirmación.')
      return
    }
    setPending(true)
    setError('')
    setNotice('')
    try {
      const { error: authError } = await client.auth.updateUser({ password })
      if (authError) throw authError
      setPassword('')
      setConfirmation('')
      setNotice('Contraseña actualizada. Ya puedes entrar sin solicitar un enlace por correo.')
      onRecovered?.()
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setPending(false)
    }
  }

  return <section className="account-security" aria-label="Seguridad de la cuenta">
    <button className="account-security-trigger" type="button" aria-expanded={open}
      disabled={pending} onClick={() => {
        if (open) { setPassword(''); setConfirmation('') }
        setOpen(!open)
        setError('')
      }}>
      {open ? 'Ocultar seguridad de la cuenta' : 'Seguridad de la cuenta · Contraseña'}
    </button>
    {open && <>
      <p>{recovering ? 'Establece una contraseña nueva para recuperar tu acceso.' :
        'Si entrabas con un enlace, establece una contraseña. Si ya tienes una, puedes cambiarla aquí.'}</p>
      <form className="auth-form" onSubmit={event => void submit(event)}>
        <label htmlFor={id + '-new'}>Contraseña nueva (mínimo 12 caracteres)</label>
        <input id={id + '-new'} type="password" required minLength={12} maxLength={128}
          autoComplete="new-password" disabled={pending} value={password}
          onChange={event => setPassword(event.target.value)} />
        <label htmlFor={id + '-confirm'}>Repetir contraseña nueva</label>
        <input id={id + '-confirm'} type="password" required minLength={12} maxLength={128}
          autoComplete="new-password" disabled={pending} value={confirmation}
          onChange={event => setConfirmation(event.target.value)} />
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
      <p className="auth-help">El servidor puede exigir una verificación adicional si su política de seguridad la requiere.</p>
    </>}
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </section>
}
