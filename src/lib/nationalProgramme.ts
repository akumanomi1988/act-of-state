import type { Dossier, DecisionEvent } from './types'

export const CHAPTERS = [
  { id:'founding', label:'Fundación del Gobierno', short:'Inicio' },
  { id:'society', label:'Bienestar y pacto social', short:'Sociedad' },
  { id:'economy', label:'Prosperidad y recursos', short:'Economía' },
  { id:'institutions', label:'Instituciones y democracia', short:'Instituciones' },
  { id:'resilience', label:'Resiliencia y relaciones exteriores', short:'Resiliencia' }
] as const

export type ProgrammeChapter = typeof CHAPTERS[number]['id']

export interface ChapterProgress {
  id: ProgrammeChapter
  label: string
  short: string
  total: number
  signed: number
  pending: number
  dossiers: Dossier[]
  next: Dossier | null
}

const validChapter = new Set<string>(CHAPTERS.map(x => x.id))

/**
 * News publication remains independent. The initial ten permanent scenarios
 * keep their historical intro status and are grouped as the founding phase.
 * A pre-migration intro without a chapter remains founding for compatibility.
 */
export function chapterOf(dossier: Dossier): ProgrammeChapter | null {
  if (dossier.release_kind === 'weekly') return null
  const chapter=dossier.programme_chapter
  return chapter && validChapter.has(chapter)
    ? chapter as ProgrammeChapter
    : 'founding'
}

function dossierKey(dossier: Dossier) {
  return dossier.id + ':' + dossier.version
}

export function buildProgrammeProgress(dossiers: Dossier[], events: DecisionEvent[]): {
  chapters: ChapterProgress[]
  total: number
  signed: number
  next: Dossier | null
} {
  const eventKeys=new Set(events.map(event => event.dossier_id+':'+event.dossier_version))
  const chapters: ChapterProgress[]=CHAPTERS.map(chapter=>{
    const list=dossiers.filter(d=>chapterOf(d)===chapter.id).sort((a,b)=>
      (a.programme_order ?? 99)-(b.programme_order ?? 99)||
      a.id.localeCompare(b.id)||
      b.version-a.version)
    const signed=list.filter(d=>eventKeys.has(dossierKey(d))).length
    return {...chapter,total:list.length,signed,
      pending:list.length-signed,dossiers:list,
      next:list.find(d=>!eventKeys.has(dossierKey(d)))??null}
  })
  return {
    chapters,total:chapters.reduce((s,x)=>s+x.total,0),
    signed:chapters.reduce((s,x)=>s+x.signed,0),
    next:chapters.find(ch=>ch.next)?.next??null
  }
}

export function reformChapter(dossier: Dossier) {
  const chapter=chapterOf(dossier)
  return chapter!==null && chapter!=='founding'
}
