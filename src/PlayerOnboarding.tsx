import type { GovernmentWorld } from './lib/types'
import type { MatchWorld } from './lib/multiplayer'
import { chapterOf, reformChapter } from './lib/nationalProgramme'

export function onboardingSteps(world: GovernmentWorld | MatchWorld) {
 const dossiers=world.dossiers??[]
 const signedIds=new Set((world.events??[]).map(event=>event.dossier_id))
 const foundation=dossiers.filter(dossier=>chapterOf(dossier)==='founding')
 const reforms=dossiers.filter(reformChapter)
 const foundationSigned=foundation.filter(dossier=>signedIds.has(dossier.id)).length
 const reformSigned=reforms.filter(dossier=>signedIds.has(dossier.id)).length
 if ('match' in world) {
  const match = world
  const ready = !match.match.readiness_required || match.me.is_ready
  const active = match.match.status === 'active'
  const stance = match.stances.some(s => s.user_id === match.me.user_id)
  return [
   { label: 'Tu partido forma parte de la asamblea', done: true, guide: 'assembly' },
   { label: ready ? 'Preparación confirmada o no requerida' : 'Confirma tu preparación en la sala', done: ready, guide: 'assembly' },
   { label: active ? 'Asamblea activa' : 'Espera al inicio del anfitrión: hacen falta al menos dos partidos', done: active, guide: 'assembly' },
   { label: 'Registra tu primera postura de partido', done: stance, guide: 'parliament' },
   { label: 'Consulta cómo se vota y se ejecuta una medida', done: false, guide: 'parliament' }
  ]
 }

 return [
  { label: 'Gobierno persistente recuperado', done: true, guide: 'access' },
  { label: 'Firma tu primera decisión', done: world.events.length > 0, guide: 'first-decision' },
  ...(foundation.length>0?[{
   label:'Programa fundacional: '+foundationSigned+' de '+foundation.length+' decisiones',
   done:foundationSigned===foundation.length,guide:'foundational-programme'
  }]:[]),
  ...(reforms.length>0?[{
   label:'Programa nacional de reformas: '+reformSigned+' de '+reforms.length+' decisiones',
   done:reformSigned===reforms.length,guide:'national-reforms'
  }]:[]),
  { label: world.calendar.weeklyTotal > 0 ? 'Agenda semanal publicada' : 'La agenda semanal está pendiente de publicación editorial', done: world.calendar.weeklyTotal > 0, guide: 'calendar' },
  { label: 'Conoce el presupuesto y sus consecuencias sociales', done: false, guide: 'budget' }
 ]
}

export default function PlayerOnboarding({ world }: { world: GovernmentWorld | MatchWorld }) {
 const steps = onboardingSteps(world)
 return <section className="onboarding-panel" aria-label="Primeros pasos del jugador">
  <h2>Tu siguiente paso</h2>
  <p>Esta orientación usa el estado guardado. Leer la guía no ejecuta acciones políticas.</p>
  <ol>{steps.map(step=><li key={step.guide+step.label}>
   <span>{step.done ? '✓ ' : '○ '}{step.label}</span>{' '}<a href={'/guide#'+step.guide}>Cómo funciona</a>
  </li>)}</ol>
  <a href="/guide">Consultar el manual completo</a>
 </section>
}
