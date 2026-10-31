type GameMode = 'solo' | 'parliament'
type Entry = { href: string; title: string; detail: string; mode?: GameMode }
const entries: readonly Entry[] = [
 {href:'/',title:'Partida individual',detail:'Gobierna y firma tus decisiones',mode:'solo'},
 {href:'/multiplayer',title:'Partida parlamentaria',detail:'Hasta diez partidos',mode:'parliament'},
 {href:'/demo',title:'Partida de prueba',detail:'Cuatro decisiones sin cuenta'},
 {href:'/guide',title:'Reglas del juego',detail:'Acciones, votos y plazos'},
 {href:'/status',title:'Estado del servicio',detail:'Disponibilidad y versión'}
]
/** Site routes, not game commands: switching modes cannot create or delete a save. */
export default function GameMenu({current}:{current:GameMode}) {
 return <details className="game-menu">
   <summary aria-label="Abrir menú del juego">Menú</summary>
   <nav aria-label="Menú del juego" className="game-menu-list">
     <span className="game-menu-label">MODO DE JUEGO</span>
     {entries.map(entry=><a key={entry.href} href={entry.href}
       aria-current={entry.mode===current?'page':undefined}
       className={entry.mode===current?'current':''}>
       <strong>{entry.title}</strong><small>{entry.detail}</small>
     </a>)}
   </nav>
 </details>
}
