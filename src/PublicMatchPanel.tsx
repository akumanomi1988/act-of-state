import { useEffect, useState, type FormEvent } from 'react'
import { listPublicLobbies, type PublicLobby } from './lib/matchmaking'

export default function PublicMatchPanel({
  identity, disabled, onJoin
}: {
  identity: string
  disabled: boolean
  onJoin: (matchId: string, partyName: string) => Promise<void>
}) {
  const [lobbies, setLobbies] = useState<PublicLobby[]>([])
  const [partyName, setPartyName] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setLobbies([])
    setSelected(null)
    setPartyName('')
    setLoading(true)
    setError('')
    const refresh = async () => {
      try {
        const value = await listPublicLobbies()
        if (alive) { setLobbies(value); setError('') }
      } catch {
        if (alive) { setLobbies([]); setError('No se pudo consultar el tablón de partidas.') }
      } finally { if (alive) setLoading(false) }
    }
    void refresh()
    const interval = window.setInterval(() => { void refresh() },30000)
    return () => { alive = false; window.clearInterval(interval) }
  }, [identity])

  const chosen = lobbies.find(lobby => lobby.id === selected)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!chosen || joining || disabled || partyName.trim().length < 3) return
    setJoining(true)
    setError('')
    try {
      await onJoin(chosen.id,partyName.trim())
      setSelected(null)
      const refreshed = await listPublicLobbies()
      setLobbies(refreshed)
    } catch {
      setError('La plaza ya no está disponible o el servidor ha rechazado la incorporación.')
    } finally { setJoining(false) }
  }

  return <section className="match-public-directory" aria-label="Directorio de partidas públicas">
    <div className="match-directory-heading">
      <h3>Buscar partida pública</h3>
      <small>Unirse sin código</small>
    </div>
    <p className="muted">Partidas abiertas por sus anfitriones. Las privadas no aparecen aquí.</p>
    {loading && <p role="status">Buscando asambleas con plazas…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !lobbies.length &&
      <p className="muted">Ahora mismo no hay partidas públicas con plazas libres.</p>}
    {lobbies.length>0 && <div className="match-directory-list">
      {lobbies.map(lobby=><button key={lobby.id} type="button"
        className={selected===lobby.id?'selected':''}
        aria-pressed={selected===lobby.id}
        disabled={disabled||joining}
        onClick={()=>setSelected(lobby.id)}>
        <strong>{lobby.title}</strong>
        <span>{lobby.player_count}/10 partidos · {lobby.open_seats} plazas libres</span>
      </button>)}
    </div>}
    {chosen && <form className="match-form" onSubmit={event=>void submit(event)}>
      <label>Tu partido para esta partida
        <input aria-label="Nombre del partido para partida pública"
          minLength={3} maxLength={60} required
          disabled={disabled||joining} value={partyName}
          onChange={event=>setPartyName(event.target.value)}
          placeholder="Alianza Social"/>
      </label>
      <button type="submit" disabled={disabled||joining||partyName.trim().length<3}>
        {joining?'Uniéndote…':'Unirme a la asamblea'}
      </button>
    </form>}
    <p className="muted">El ingreso y la asignación de escaño son transaccionales:
      si la partida se llena o comienza, nadie obtiene una plaza ficticia.</p>
  </section>
}
