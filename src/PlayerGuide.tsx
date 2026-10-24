export const guideSections = [
 ['access','Acceso y recuperación','Entra con tu correo y abre el enlace de acceso. Si no llega, revisa spam y espera antes de reenviar. Un límite de correo no significa que hayas iniciado sesión. Mantén tu cuenta para recuperar el mismo gobierno.'],
 ['first-decision','Tu primera decisión','Comienza por los expedientes introductorios ficticios. Lee el contexto, compara opciones, revisa el compromiso fiscal y confirma la firma. La decisión es definitiva; el resultado y su historial proceden del servidor. Si se pierde la respuesta, sincroniza antes de reintentar.'],
 ['calendar','Una semana política','Un día real equivale a un día de juego. El calendario usa UTC. Los lunes se habilitan diez expedientes cuando la redacción los ha verificado y publicado. Se resuelven de lunes a viernes; el cierre se certifica después de terminar el viernes UTC. No hay que dejar el navegador abierto.'],
 ['budget','Presupuesto y población','El presupuesto reparte el 100 % entre sanidad, educación, infraestructuras y seguridad. El gobierno puede hacer una revisión distinta por semana dentro de los límites mostrados. La liquidación fiscal es semanal. El bienestar se mide diariamente y afecta gradualmente al apoyo y la confianza.'],
 ['assembly','Entrar en una asamblea','Busca una partida pública o usa una invitación privada. Cada cuenta representa un partido; hay hasta diez. Se necesitan al menos dos para comenzar. Si se exige preparación, todos deben confirmarla. Puedes salir de una sala abierta; una partida activa conserva su participación.'],
 ['parliament','Gobierno y oposición','Todos los partidos pueden registrar su postura. El gabinete propone una medida al Parlamento; los partidos votan con el peso de sus escaños. El gobierno solo puede ejecutar una opción aprobada. Una postura de partido o un voto no firma por sí mismo una decisión nacional.'],
 ['elections','Campaña y elecciones','Tu programa y las reacciones de los hogares influyen en el voto simulado. Cada partido dispone de una acción de campaña por semana fuera del periodo de cierre electoral. Las seis circunscripciones reparten cien escaños por D’Hondt. Las proyecciones y mediciones diarias no sustituyen al acta electoral certificada.'],
 ['governance','Coaliciones y confianza','Las alianzas requieren aceptación de sus miembros. Una moción constructiva propone un gabinete alternativo y usa el peso parlamentario. Consulta el resultado certificado para saber quién tiene autoridad ejecutiva. Ser anfitrión inicial no garantiza gobernar para siempre.'],
 ['history','Agenda y rendición de cuentas','Consulta la bandeja política para ver actuaciones pendientes. Marcar un aviso como leído no vota, firma ni completa esa actuación. El archivo semanal conserva fuentes, posturas, votos y decisiones. Los días sin medición aparecen como huecos, sin inventar datos.'],
 ['fair-play','Juego gratuito y datos sintéticos','Jugar es gratuito y no hay ventajas competitivas de pago. Los hogares, territorios e indicadores son una simulación ficticia, no encuestas ni datos personales. Las noticias aportan contexto editorial; las alternativas y sus efectos son reglas del juego.']
] as const

export default function PlayerGuide() {
 return <div className="app-shell"><header className="masthead">
  <div className="wordmark">ACT OF STATE</div><nav className="header-end" aria-label="Navegación principal">
   <a href="/">Gobierno</a><a href="/multiplayer">Asambleas</a></nav>
 </header><main className="guide-content"><p className="eyebrow">MANUAL DEL JUGADOR</p>
  <h1>De tu primera decisión a un mandato compartido</h1>
  <p>Aprende las reglas antes de comprometer a tu gobierno. No necesitas una cuenta para consultar esta guía.</p>
  <nav aria-label="Contenido del manual"><ol>{guideSections.map(([id,title])=><li key={id}><a href={'#'+id}>{title}</a></li>)}</ol></nav>
  {guideSections.map(([id,title,body])=><section id={id} key={id}><h2>{title}</h2><p>{body}</p></section>)}
  <p><a className="text-button" href="/">Entrar al gobierno</a> <a className="text-button" href="/multiplayer">Buscar una asamblea</a></p>
 </main></div>
}
