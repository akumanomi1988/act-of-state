import {useEffect,useState} from 'react'
export const guideSections = [
 ['demo','Partida de prueba','Entra en Partida de prueba para resolver cuatro casos ficticios sin iniciar sesión. Sus cifras son ejemplos pedagógicos: no siguen el motor real, no afectan a partidas oficiales y no se transfieren al crear tu gobierno. El progreso del ensayo solo se conserva en este navegador.'],
 ['access','Acceso y recuperación','Entra directamente con correo y contraseña, sin recibir un mensaje en cada sesión. Puedes registrar una cuenta nueva (tal vez requiera una confirmación inicial). Si ya usabas enlaces de acceso, entra una vez por «Acceder por correo» y establece una contraseña desde «Seguridad de la cuenta». Si la olvidas, solicita su recuperación por correo. Tu gobierno y tus partidos pertenecen a la misma identidad.'],
 ['service','Estado del servicio y recuperación','En Estado del servicio puedes consultar la revisión de la web y comprobar si el acceso básico responde. No verifica el envío de correos, tu conexión personal ni las transacciones de la partida. Si una firma o voto pierde conexión, conserva la sesión, vuelve a sincronizar y no repitas acciones ambiguas hasta leer el acta oficial. Los avisos de versión no implican que tus datos hayan desaparecido.'],
 ['first-decision','Tu primera decisión','Comienza por los expedientes introductorios ficticios. Lee el contexto, compara opciones, revisa el compromiso fiscal y confirma la firma. La decisión es definitiva; el resultado y su historial proceden del servidor. Si se pierde la respuesta, sincroniza antes de reintentar.'],
 ['weekly-operations','Semana parlamentaria','La agenda parlamentaria reúne los asuntos de los partidos. Cada publicación semanal muestra la fecha límite oficial, los expedientes, tu postura de partido, tus votos y las medidas que el Gobierno realmente ha firmado. Una postura no es un voto; aprobar una propuesta parlamentaria tampoco equivale a ejecutar el presupuesto. El partido del Gobierno puede proponer leyes y firmar aquellas que hayan recibido mandato; la oposición puede fijar posiciones y votar. Si el calendario no está sincronizado, se bloquean los accesos directos hasta recuperar datos del servidor. Los viernes se cierran los asuntos; consulta la crónica y el acta histórica después del cierre. Las noticias reales requieren diez fuentes contrastadas y aprobación editorial independiente.'],
 ['foundational-programme','Tu programa fundacional','En el despacho del gobierno encontrarás diez expedientes ficticios: dos escenarios iniciales y ocho nuevas decisiones sobre vivienda, sanidad, educación, infraestructuras, empleo, agricultura, tecnología y clima. Puedes firmarlos en cualquier orden y cada uno es definitivo para ese gobierno. La barra de progreso y las variaciones económicas y políticas provienen de las actas guardadas. Los cambios acumulados no incluyen la liquidación semanal ni la evolución diaria del país. Para las noticias actuales, utiliza la agenda semanal, separada del programa fundacional.'],
 ['national-reforms','Cuatro capítulos de reformas nacionales','Después del programa fundacional de diez políticas, Arcadia incorpora dieciocho nuevos expedientes ficticios y cincuenta y cuatro alternativas en bienestar social, economía, instituciones y resiliencia. Puedes firmarlos en solitario o debatirlos y votarlos en el Parlamento multijugador. Los costes, apoyos y actas se calculan y guardan en el servidor. Son ficción original, nunca noticias reales.'],
 ['calendar','Una semana política','Un día real equivale a un día de juego. El calendario usa UTC. Los lunes se habilitan diez expedientes cuando la redacción los ha verificado y publicado. Se resuelven de lunes a viernes; el cierre se certifica después de terminar el viernes UTC. No hay que dejar el navegador abierto.'],
 ['budget','Presupuesto y población','El presupuesto reparte el 100 % entre sanidad, educación, infraestructuras y seguridad. El gobierno puede hacer una revisión distinta por semana dentro de los límites mostrados. La liquidación fiscal es semanal. El bienestar se mide diariamente y afecta gradualmente al apoyo y la confianza.'],
 ['mandate-observatory','Balance del mandato','Consulta el balance del mandato desde Mi país. Consulta 7, 30 o 90 días de actas fiscales y de bienestar, y en multijugador la estimación histórica de voto y las elecciones certificadas. Los días sin mediciones aparecen como ausentes. Los tres escenarios de ingresos y gastos son hipótesis si el presupuesto permanece constante: no ejecutan decisiones, no pronostican hechos reales ni modifican actas.'],
 ['assembly','Entrar en una partida parlamentaria','Busca una partida pública o usa una invitación privada. Cada cuenta representa un partido; hay hasta diez. Se necesitan al menos dos para comenzar. Si se exige preparación, todos deben confirmarla. Puedes salir de una sala abierta; una partida activa conserva su participación.'],
 ['assembly-command','Expedientes del Parlamento','En las partidas activas, el orden del día muestra primero los expedientes semanales aprobados y después el programa ficticio permanente. Filtra los asuntos pendientes, tu programa o las medidas firmadas. Una postura registrada por un partido no equivale a una ley; únicamente los eventos del servidor certifican medidas nacionales. Si pierdes la respuesta al firmar, sincroniza el acta antes de repetir la acción para evitar firmas contradictorias.'],
 ['parliament','Gobierno y oposición','Todos los partidos pueden registrar su postura. El gabinete propone una medida al Parlamento; los partidos votan con el peso de sus escaños. El gobierno solo puede ejecutar una opción aprobada. Una postura de partido o un voto no firma por sí mismo una decisión nacional.'],
 ['elections','Campaña y elecciones','Tu programa y las reacciones de los hogares influyen en el voto simulado. Cada partido dispone de una acción de campaña por semana fuera del periodo de cierre electoral. La influencia ganada es temporal: pierde dos puntos cada siete días UTC sin volver a intervenir en el grupo social, y una nueva campaña recupera apoyo desde el nivel efectivo. Las campañas anteriores siguen constando en el archivo aunque su influencia disminuya. Las seis circunscripciones reparten cien escaños por D’Hondt. Las proyecciones y mediciones diarias no sustituyen al acta electoral certificada.'],
 ['governance','Coaliciones y confianza','Las alianzas requieren aceptación de sus miembros. Una moción constructiva propone un gabinete alternativo y usa el peso parlamentario. Consulta el resultado certificado para saber quién tiene autoridad ejecutiva. Ser anfitrión inicial no garantiza gobernar para siempre.'],
 ['history','Agenda y rendición de cuentas','Consulta la bandeja política para ver actuaciones pendientes. Marcar un aviso como leído no vota, firma ni completa esa actuación. El archivo semanal conserva fuentes, posturas, votos y decisiones. Los días sin medición aparecen como huecos, sin inventar datos.'],
 ['fair-play','Juego gratuito y datos sintéticos','Jugar es gratuito y no hay ventajas competitivas de pago. Los hogares, territorios e indicadores son una simulación ficticia, no encuestas ni datos personales. Las noticias aportan contexto editorial; las alternativas y sus efectos son reglas del juego.']
] as const

function sectionFromHash():string{
 const id=window.location.hash.slice(1)
 return guideSections.some(([key])=>key===id)?id:'first-decision'
}

export default function PlayerGuide(){
 const [selected,setSelected]=useState(sectionFromHash)
 useEffect(()=>{
   const update=()=>setSelected(sectionFromHash())
   window.addEventListener('hashchange',update)
   return ()=>window.removeEventListener('hashchange',update)
 },[])
 const active=guideSections.find(([id])=>id===selected)??guideSections[3]
 return <div className="app-shell">
  <header className="masthead">
   <a className="wordmark" href="/" style={{textDecoration:'none',color:'inherit'}}>ACT OF STATE</a>
   <nav className="header-end" aria-label="Navegación principal">
     <a href="/">Partida individual</a>
     <a href="/multiplayer">Partida parlamentaria</a>
     <a href="/demo">Partida de prueba</a>
   </nav>
  </header>
  <main className="guide-content game-guide">
   <div className="game-entry-kicker">ACT OF STATE / REGLAS</div>
   <h1>Reglas del juego</h1>
   <p className="game-entry-lede">Consulta las acciones y sus consecuencias.
     No necesitas iniciar sesión para leer el reglamento.</p>
   <div className="game-guide-layout">
     <nav className="game-guide-index" aria-label="Capítulos de las reglas">
       <label htmlFor="game-guide-chapter">Elige un capítulo</label>
       <select id="game-guide-chapter" value={selected}
         onChange={event=>{
           const id=event.target.value
           setSelected(id)
           window.location.hash=id
         }}>
         {guideSections.map(([id,title])=><option key={id} value={id}>{title}</option>)}
       </select>
       <details className="game-guide-toc">
         <summary>Ver todos los capítulos</summary>
         <ol>{guideSections.map(([id,title])=><li key={id}>
           <a href={'#'+id} aria-current={selected===id?'location':undefined}
             onClick={()=>setSelected(id)}>{title}</a>
         </li>)}</ol>
       </details>
     </nav>
     <div className="game-guide-page" aria-live="polite">
       {guideSections.map(([id,title,body])=><section id={id} key={id}
         hidden={selected!==id}>
         <p className="eyebrow">REGLAMENTO · CAPÍTULO {guideSections.findIndex(([key])=>key===id)+1}</p>
         <h2>{title}</h2>
         <p>{body}</p>
       </section>)}
       <div className="game-guide-next">
         <span>{guideSections.findIndex(([id])=>id===active[0])+1} de {guideSections.length}</span>
         {guideSections.findIndex(([id])=>id===selected)<guideSections.length-1
           ? <button type="button" onClick={()=>{
               const index=guideSections.findIndex(([id])=>id===selected)+1
               const id=guideSections[index][0]
               setSelected(id)
               window.location.hash=id
             }}>Siguiente capítulo</button>
           : <a href="/">Volver a jugar</a>}
       </div>
     </div>
   </div>
   <div className="game-guide-actions">
     <a className="text-button" href="/">Partida individual</a>
     <a className="text-button" href="/multiplayer">Partida parlamentaria</a>
   </div>
  </main>
 </div>
}
