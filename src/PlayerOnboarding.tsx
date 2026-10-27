import type { GovernmentWorld } from './lib/types'
import type { MatchWorld } from './lib/multiplayer'
import { chapterOf, reformChapter } from './lib/nationalProgramme'
import {publicRoute,type PublicLanguage} from './lib/publicLanguage'

export function onboardingSteps(world: GovernmentWorld | MatchWorld) {
 const dossiers=world.dossiers??[]
 const signedIds=new Set((world.events??[]).map(event=>event.dossier_id+':'+event.dossier_version))
 const foundation=dossiers.filter(dossier=>chapterOf(dossier)==='founding')
 const reforms=dossiers.filter(reformChapter)
 const foundationSigned=foundation.filter(dossier=>signedIds.has(dossier.id+':'+dossier.version)).length
 const reformSigned=reforms.filter(dossier=>signedIds.has(dossier.id+':'+dossier.version)).length
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

const onboardingTranslations:Record<string,string>={
  'Tu partido forma parte de la asamblea':'Your party belongs to the assembly',
  'Preparación confirmada o no requerida':'Ready status confirmed or not required',
  'Confirma tu preparación en la sala':'Confirm your readiness in the lobby',
  'Asamblea activa':'Assembly active',
  'Espera al inicio del anfitrión: hacen falta al menos dos partidos':'Wait for the host: at least two parties are required',
  'Registra tu primera postura de partido':'Record your first party position',
  'Consulta cómo se vota y se ejecuta una medida':'Learn how to vote and enact a policy',
  'Gobierno persistente recuperado':'Persistent government restored',
  'Firma tu primera decisión':'Sign your first decision',
  'Agenda semanal publicada':'Weekly agenda published',
  'La agenda semanal está pendiente de publicación editorial':'Weekly agenda is awaiting editorial publication',
  'Conoce el presupuesto y sus consecuencias sociales':'Learn about the budget and its social consequences'
}

/** Translate hints only; retain signed counts and authoritative state as-is. */
export function onboardingStepEnglish(label:string):string {
  const match=label.match(/^(Programa fundacional|Programa nacional de reformas): (\d+) de (\d+) decisiones$/)
  if(match)return (match[1]==='Programa fundacional'?'Founding programme':'National reform programme')
    + ': '+match[2]+' of '+match[3]+' decisions'
  return onboardingTranslations[label]??label
}

export default function PlayerOnboarding({ world,language='es' }: {
 world: GovernmentWorld | MatchWorld
 language?:PublicLanguage
}) {
 const en=language==='en'
 const t=(es:string,english:string)=>en?english:es
 const steps = onboardingSteps(world)
 return <section className="onboarding-panel" aria-label={t('Primeros pasos del jugador','Player first steps')}>
  <h2>{t('Tu siguiente paso','Your next step')}</h2>
  <p>{t('Esta orientación usa el estado guardado. Leer la guía no ejecuta acciones políticas.','These suggestions come from saved game state. Reading the guide does not execute political acts.')}</p>
  <ol>{steps.map(step=><li key={step.guide+step.label}>
   <span>{step.done ? '✓ ' : '○ '}{en?onboardingStepEnglish(step.label):step.label}</span>{' '}<a href={publicRoute('/guide',language)+'#'+step.guide}>{t('Cómo funciona','How it works')}</a>
  </li>)}</ol>
  <a href={publicRoute('/guide',language)}>{t('Consultar el manual completo','Read the full guide')}</a>
 </section>
}
