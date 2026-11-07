const modes = [
 {href:'/',code:'01',title:'Partida individual',
  description:'Dirige el Gobierno. Examina expedientes, decide y afronta sus consecuencias.'},
 {href:'/multiplayer',code:'02',title:'Partida parlamentaria',
  description:'Forma un partido, negocia leyes y participa en una asamblea de hasta diez jugadores.'},
 {href:'/demo',code:'03',title:'Partida de prueba',
  description:'Prueba cuatro decisiones de ejemplo sin crear una cuenta.'}
] as const

/** A mode picker has no gameplay side effects or implied save creation. */
export default function GameModeSelect({selected}:{selected:'solo'|'parliament'}){
 return <nav className="game-mode-select" aria-label="Elegir modo de juego">
   {modes.map(mode=><a key={mode.href} href={mode.href}
     aria-current={(selected==='solo'&&mode.href==='/')||
       (selected==='parliament'&&mode.href==='/multiplayer')?'page':undefined}
     className="game-mode-card">
     <span className="game-mode-number">{mode.code}</span>
     <span className="game-mode-information"><strong>{mode.title}</strong>
       <small>{mode.description}</small></span>
     <span className="game-mode-arrow" aria-hidden="true">›</span>
   </a>)}
 </nav>
}
