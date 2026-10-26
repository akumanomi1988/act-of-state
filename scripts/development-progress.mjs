import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const expectedIds = [
  ...Array.from({length:8},(_,i)=>'MVP-F'+String(i+1).padStart(3,'0')),
  ...Array.from({length:6},(_,i)=>'MVP-T'+String(i+1).padStart(3,'0')),
  ...Array.from({length:4},(_,i)=>'MVP-V'+String(i+1).padStart(3,'0'))
]
const pct = (numerator, denominator) => Math.round(numerator*1000/denominator)/10
const close = (text) => text.replace(/\r\n/g,'\n')

export function calculateDevelopmentCoverage(card,{proofExists}={
  proofExists: path => existsSync(resolve(repoRoot,path))
}) {
  if (!card || card.schemaVersion !== 1 || !Array.isArray(card.requirements) ||
    card.requirements.length !== 18 || !card.commercialAcceptance ||
    card.commercialAcceptance.total !== 18 ||
    !card.baseMilestone || !card.currentMilestone ||
    card.baseMilestone === card.currentMilestone)
    throw Error('COVERAGE_SCHEMA_INVALID')
  const observed = new Set()
  const finished = []
  const grouped = {}
  let complete = 0, baseline = 0
  for(const requirement of card.requirements) {
    if (!expectedIds.includes(requirement.id) || observed.has(requirement.id) ||
        typeof requirement.name !== 'string' ||
        !Array.isArray(requirement.checkpoints) ||
        requirement.checkpoints.length !== 4)
      throw Error('COVERAGE_REQUIREMENT_INVALID')
    observed.add(requirement.id)
    let count = 0
    for(let i=0;i<4;i++) {
      const checkpoint = requirement.checkpoints[i]
      if (!checkpoint || checkpoint.key !== requirement.id+'.'+(i+1) ||
          typeof checkpoint.description !== 'string' ||
          !['verified','pending'].includes(checkpoint.state))
        throw Error('COVERAGE_CHECKPOINT_INVALID')
      if(checkpoint.state === 'verified') {
        if(typeof checkpoint.proof !== 'string' ||
          !/^(src|docs|supabase|scripts|tests)\/[a-zA-Z0-9_./-]+$/.test(checkpoint.proof) ||
          checkpoint.proof.includes('..') || !proofExists(checkpoint.proof) ||
          typeof checkpoint.creditedIn !== 'string')
          throw Error('COVERAGE_EVIDENCE_MISSING: '+checkpoint.key)
        complete++;count++
        if(checkpoint.creditedIn !== card.currentMilestone) baseline++
        finished.push(checkpoint.key)
      }else if(checkpoint.proof !== null || checkpoint.creditedIn !== null) {
        throw Error('COVERAGE_UNVERIFIED_POINT: '+checkpoint.key)
      }
    }
    const group=requirement.id.charAt(4)
    grouped[group]??={verified:0,total:0}
    grouped[group].verified+=count
    grouped[group].total+=4
  }
  if(observed.size !== expectedIds.length)
    throw Error('COVERAGE_REQUIREMENTS_MISSING')
  const accepted=card.commercialAcceptance.complete
  if(!Array.isArray(accepted) || accepted.length !== 2 ||
     new Set(accepted).size !== accepted.length ||
     accepted.some(id=>!observed.has(id)))
    throw Error('COVERAGE_COMMERCIAL_SCHEMA_INVALID')
  const total=card.requirements.length*4
  return {
    baseline:{verified:baseline,total,percent:pct(baseline,total)},
    current:{verified:complete,total,percent:pct(complete,total)},
    deltaPoints:Math.round((complete-baseline)*1000/total)/10,
    commercial:{accepted:accepted.length,total:18,percent:pct(accepted.length,18)},
    grouped:Object.fromEntries(Object.entries(grouped).map(([key,v])=>[
      key,{...v,percent:pct(v.verified,v.total)}
    ])),
    finished
  }
}

export function renderDevelopmentReport(card,score) {
 const lines=[
  '# ACT OF STATE — Verifiable implementation coverage',
  '',
  '> Metric: **'+score.current.verified+'/'+score.current.total+' verified checkpoints ('+
    score.current.percent.toFixed(1)+'%)** on '+card.currentMilestone+
    '. Commercial acceptance is a different figure: **'+score.commercial.accepted+
    '/'+score.commercial.total+' ('+score.commercial.percent.toFixed(1)+'%)**.',
  '',
  '## Before / after',
  '',
  '| Metric | '+card.baseMilestone+' | '+card.currentMilestone+' | Delta |',
  '| --- | ---: | ---: | ---: |',
  '| Implemented & evidenced | '+score.baseline.percent.toFixed(1)+'% ('+
    score.baseline.verified+'/'+score.baseline.total+') | '+
    score.current.percent.toFixed(1)+'% ('+score.current.verified+'/'+score.current.total+
    ') | '+(score.deltaPoints>=0?'+':'')+score.deltaPoints.toFixed(1)+' pp |',
  '| Full commercial acceptance | '+score.commercial.percent.toFixed(1)+
    '% ('+score.commercial.accepted+'/18) | '+score.commercial.percent.toFixed(1)+
    '% ('+score.commercial.accepted+'/18) | 0.0 pp |',
  '',
  '## Rules and boundaries',
  '',
  '- Scope is the **18 original MVP requirements** (F001–F008, T001–T006, V001–V004).',
  '- Every requirement has **four fixed, individually named, binary technical delivery checkpoints**.',
  '- Each checkpoint weighs exactly **1/72** of implementation coverage. No points for partial work, lines of code, plans or commits without linked evidence.',
  '- A verified checkpoint requires an existing tracked code/test/specification file plus reviewed engineering evidence. Existence of a file alone is insufficient; CI independently validates executable artifacts.',
  '- Pending checkpoints do not count. In particular, hosted operations, real reviewed news, ten human participants and human visual approval are not silently assumed.',
  '- This is a **traceable coverage indicator for the currently enumerated product scope**, not a calibrated estimate of remaining engineering hours, a user-experience quality score or proof of a commercially finished game.',
  '- Current branch AOS-053 is not automatically deployed. The AOS-050 production schema/authentication transition and release remain separate.',
  '- Future milestones should retain the checkpoint IDs, credit new achievements to their milestone and replace prior entries only with an explicit change explanation.',
  '',
  '## Capability coverage by original requirement',
  '',
  '| Original area | Completed / defined | Percent |',
  '| --- | ---: | ---: |'
 ]
 for(const area of ['F','T','V']){
  const name={F:'Gameplay & simulation',T:'Engineering & reliability',V:'Visuals & interface'}[area]
  const group=score.grouped[area]
  lines.push('| '+name+' | '+group.verified+'/'+group.total+' | '+group.percent.toFixed(1)+'% |')
 }
 lines.push('','## Checkpoint-by-checkpoint evidence','')
 for(const item of card.requirements){
  const verified=item.checkpoints.filter(x=>x.state==='verified').length
  lines.push('### '+item.id+' — '+item.name+' ('+verified+'/4)','')
  for(const cp of item.checkpoints){
    const label=cp.state==='verified'?'[x]':'[ ]'
    const proof=cp.state==='verified'?
      ' — file: `'+cp.proof+'` ('+cp.creditedIn+')':' — pending'
    lines.push('- '+label+' '+cp.description+proof)
  }
  lines.push('')
 }
 lines.push('## Reproducible computation','',
   '- Score source of truth: `docs/development-coverage.json`.',
   '- Calculation and evidence existence guard: `node scripts/development-progress.mjs`.',
   '- Regenerate: `node scripts/development-progress.mjs --write`.',
   '- CI drift check: `node scripts/development-progress.mjs --check`.',
   '- Independent regression: `node --test tests/development-progress.test.mjs`.',
   '- Baseline'+': '+card.baseMilestone+'; new checkpoints in '+card.currentMilestone+
    ' are explicitly labeled in the scorecard.',
   '- Current CI receipts: '+Object.values(card.evidenceRuns).join(' · ')+'.',''
 )
 return lines.join('\n')
}

function runCli() {
 const card=JSON.parse(readFileSync(resolve(repoRoot,'docs/development-coverage.json'),'utf8'))
 const score=calculateDevelopmentCoverage(card)
 const output=renderDevelopmentReport(card,score)
 const filename=resolve(repoRoot,'docs/DEVELOPMENT_PROGRESS.md')
 const mode=process.argv[2]
 if(mode==='--write')writeFileSync(filename,output)
 else if(mode==='--check') {
   if(!existsSync(filename) || close(readFileSync(filename,'utf8'))!==output)
     throw Error('DEVELOPMENT_PROGRESS_OUTDATED: npm run progress:write')
 }else if(mode && mode!=='--json')throw Error('UNKNOWN_PROGRESS_MODE')
 console.log(JSON.stringify({baseMilestone:card.baseMilestone,
   currentMilestone:card.currentMilestone,...score},null,2))
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  runCli()
