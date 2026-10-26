import {useState} from 'react'
import {parsePublicLanguage, publicRoute, updatePublicLanguage} from './lib/publicLanguage'
import {guideSectionsEnglish} from './PlayerGuide.en'
export const guideSections = [
 ['demo','Ensayo sin cuenta','Puedes visitar /demo y probar cuatro dilemas ficticios sin iniciar sesión. Sus cifras son ejemplos pedagógicos: no siguen el motor real, no afectan a partidas oficiales y no se transfieren al crear tu gobierno. El progreso del ensayo solo se conserva en este navegador.'],
 ['access','Acceso y recuperación','Puedes entrar con correo y contraseña sin recibir correos cada vez. Si todavía accedes por enlace, entra una vez, abre «Configurar contraseña de acceso» en tu despacho o asamblea y guarda una contraseña de al menos 12 caracteres: conservarás la misma cuenta, gobierno y partidas. El enlace sigue disponible para el primer acceso y para recuperar una contraseña olvidada; la recuperación sí puede requerir un correo. La sesión del navegador persiste mientras sea válida. Nunca compartas códigos, contraseñas ni enlaces.'],
 ['service','Estado del servicio y recuperación','La página pública /status permite identificar la revisión de la web y comprobar si responde el acceso básico. No verifica el envío de correos, tu conexión personal ni las transacciones de la partida. Si una firma o voto pierde conexión, conserva la sesión, vuelve a sincronizar y no repitas acciones ambiguas hasta leer el acta oficial. Los avisos de versión no implican que tus datos hayan desaparecido.'],
 ['first-decision','Tu primera decisión','Comienza por los expedientes introductorios ficticios. Lee el contexto, compara opciones, revisa el compromiso fiscal y confirma la firma. La decisión es definitiva; el resultado y su historial proceden del servidor. Si se pierde la respuesta, sincroniza antes de reintentar.'],
 ['weekly-operations','Operaciones de una semana política','La sala de operaciones legislativas es el centro de trabajo de los diez partidos. Cada publicación semanal muestra la fecha límite oficial, los expedientes, tu postura de partido, tus votos y las medidas que el Gobierno realmente ha firmado. Una postura no es un voto; aprobar una propuesta parlamentaria tampoco equivale a ejecutar el presupuesto. El partido del Gobierno puede proponer leyes y firmar aquellas que hayan recibido mandato; la oposición puede fijar posiciones y votar. Si el calendario no está sincronizado, se bloquean los accesos directos hasta recuperar datos del servidor. Los viernes se cierran los asuntos; consulta la crónica y el acta histórica después del cierre. Las noticias reales requieren diez fuentes contrastadas y aprobación editorial independiente.'],
 ['foundational-programme','Tu programa fundacional','En el despacho del gobierno encontrarás diez expedientes ficticios: dos escenarios iniciales y ocho nuevas decisiones sobre vivienda, sanidad, educación, infraestructuras, empleo, agricultura, tecnología y clima. Puedes firmarlos en cualquier orden y cada uno es definitivo para ese gobierno. La barra de progreso y las variaciones económicas y políticas provienen de las actas guardadas. Los cambios acumulados no incluyen la liquidación semanal ni la evolución diaria del país. Para las noticias actuales, utiliza la agenda semanal, separada del programa fundacional.'],
 ['national-reforms','Cuatro capítulos de reformas nacionales','Después del programa fundacional de diez políticas, Arcadia incorpora dieciocho nuevos expedientes ficticios con cinco alternativas cada uno en bienestar social, economía, instituciones y resiliencia. Todos son asuntos permanentes: puedes firmarlos en solitario o debatirlos y votarlos en el Parlamento multijugador. El contador de las reformas no altera el progreso del capítulo fundacional. Estas situaciones son ficción original, nunca noticias reales ni fuentes verificadas. Sus costes, apoyos y actas se calculan y almacenan en el servidor.'],
 ['calendar','Una semana política','Un día real equivale a un día de juego. El calendario usa UTC. Los lunes se habilitan diez expedientes cuando la redacción los ha verificado y publicado. Se resuelven de lunes a viernes; el cierre se certifica después de terminar el viernes UTC. No hay que dejar el navegador abierto.'],
 ['budget','Presupuesto y población','El presupuesto reparte el 100 % entre sanidad, educación, infraestructuras y seguridad. El gobierno puede hacer una revisión distinta por semana dentro de los límites mostrados. La liquidación fiscal es semanal. El bienestar se mide diariamente y afecta gradualmente al apoyo y la confianza.'],
 ['assembly','Entrar en una asamblea','Busca una partida pública o usa una invitación privada. Cada cuenta representa un partido; hay hasta diez. Se necesitan al menos dos para comenzar. Si se exige preparación, todos deben confirmarla. Puedes salir de una sala abierta; una partida activa conserva su participación.'],
 ['assembly-command','Centro de decisiones parlamentarias','En las partidas activas, el Consejo político muestra primero los expedientes semanales aprobados y después el programa ficticio permanente. Filtra los asuntos pendientes, tu programa o las medidas firmadas. Una postura registrada por un partido no equivale a una ley; únicamente los eventos del servidor certifican medidas nacionales. Si pierdes la respuesta al firmar, sincroniza el acta antes de repetir la acción para evitar firmas contradictorias.'],
 ['parliament','Gobierno y oposición','Todos los partidos pueden registrar su postura. El gabinete propone una medida al Parlamento; los partidos votan con el peso de sus escaños. El gobierno solo puede ejecutar una opción aprobada. Una postura de partido o un voto no firma por sí mismo una decisión nacional.'],
 ['elections','Campaña y elecciones','Tu programa y las reacciones de los hogares influyen en el voto simulado. Cada partido dispone de una acción de campaña por semana fuera del periodo de cierre electoral. La influencia ganada es temporal: pierde dos puntos cada siete días UTC sin volver a intervenir en el grupo social, y una nueva campaña recupera apoyo desde el nivel efectivo. Las campañas anteriores siguen constando en el archivo aunque su influencia disminuya. Las seis circunscripciones reparten cien escaños por D’Hondt. Las proyecciones y mediciones diarias no sustituyen al acta electoral certificada.'],
 ['governance','Coaliciones y confianza','Las alianzas requieren aceptación de sus miembros. Una moción constructiva propone un gabinete alternativo y usa el peso parlamentario. Consulta el resultado certificado para saber quién tiene autoridad ejecutiva. Ser anfitrión inicial no garantiza gobernar para siempre.'],
 ['history','Agenda y rendición de cuentas','Consulta la bandeja política para ver actuaciones pendientes. Marcar un aviso como leído no vota, firma ni completa esa actuación. El archivo semanal conserva fuentes, posturas, votos y decisiones. Los días sin medición aparecen como huecos, sin inventar datos.'],
 ['fair-play','Juego gratuito y datos sintéticos','Jugar es gratuito y no hay ventajas competitivas de pago. Los hogares, territorios e indicadores son una simulación ficticia, no encuestas ni datos personales. Las noticias aportan contexto editorial; las alternativas y sus efectos son reglas del juego.']
] as const

export default function PlayerGuide() {
 const [language,setLanguage]=useState<'es'|'en'>(()=>{
   return parsePublicLanguage(window.location.search)
 })
 function chooseLanguage(next:'es'|'en') {
   updatePublicLanguage(next)
   setLanguage(next)
 }
 const en=language==='en'
 const sections=en?guideSectionsEnglish:guideSections
 return <div className="app-shell"><header className="masthead">
  <div className="wordmark">ACT OF STATE</div><nav className="header-end" aria-label={en?'Main navigation':'Navegación principal'}>
   <a href="/">{en?'Government':'Gobierno'}</a><a href={publicRoute("/demo",language)}>{en?'Try the demo':'Ensayo sin cuenta'}</a>
   <a href="/multiplayer">{en?'Assemblies':'Asambleas'}</a>
   <a href={publicRoute("/status",language)}>{en?'Service status':'Estado del servicio'}</a></nav>
 </header><main className="guide-content" lang={language}>
  <div role="group" aria-label={en?'Guide language':'Idioma del manual'}>
    <button type="button" aria-pressed={!en} onClick={()=>chooseLanguage('es')}>Español</button>
    <button type="button" aria-pressed={en} onClick={()=>chooseLanguage('en')}>English</button>
  </div>
  <p className="eyebrow">{en?'PLAYER MANUAL':'MANUAL DEL JUGADOR'}</p>
  <h1>{en?'From your first decision to a shared mandate':'De tu primera decisión a un mandato compartido'}</h1>
  <p>{en?'Learn the rules before committing your government. This guide is public and requires no account.':'Aprende las reglas antes de comprometer a tu gobierno. No necesitas una cuenta para consultar esta guía.'}</p>
  <nav aria-label={en?'Guide contents':'Contenido del manual'}>
   <ol>{sections.map(([id,title])=><li key={id}><a href={'#'+id}>{title}</a></li>)}</ol>
  </nav>
  {sections.map(([id,title,body])=><section id={id} key={id}>
    <h2>{title}</h2><p>{body}</p>
  </section>)}
  <p><a className="text-button" href="/">{en?'Enter government':'Entrar al gobierno'}</a>{' '}
   <a className="text-button" href="/multiplayer">{en?'Find an assembly':'Buscar una asamblea'}</a></p>
 </main></div>
}
