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
  if (!card || card.schemaVersion !== 2 || !Array.isArray(card.requirements) ||
    !Array.isArray(card.stageWeights) ||
    card.stageWeights.join(',') !== '1,2,3,4' ||
    card.requirements.length !== 18 || !card.commercialAcceptance ||
    card.commercialAcceptance.total !== 18 ||
    !card.baseMilestone || !card.currentMilestone ||
    card.baseMilestone === card.currentMilestone)
    throw Error('COVERAGE_SCHEMA_INVALID')
  const observed = new Set()
  const finished = []
  const grouped = {}
  let complete = 0, baseline = 0
  let weightedComplete = 0, weightedBaseline = 0, weightedTotal = 0
  for(const requirement of card.requirements) {
    if (!expectedIds.includes(requirement.id) || observed.has(requirement.id) ||
        typeof requirement.name !== 'string' ||
        !Array.isArray(requirement.checkpoints) ||
        requirement.checkpoints.length !== 4 ||
        !Number.isInteger(requirement.complexityWeight) ||
        requirement.complexityWeight < 1 || requirement.complexityWeight > 12 ||
        typeof requirement.complexityRationale !== 'string' ||
        requirement.complexityRationale.length < 20 || requirement.complexityRationale.length > 180)
      throw Error('COVERAGE_REQUIREMENT_INVALID')
    observed.add(requirement.id)
    let count = 0
    weightedTotal += requirement.complexityWeight * 10
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
        weightedComplete += requirement.complexityWeight * card.stageWeights[i]
        if(checkpoint.creditedIn !== card.currentMilestone) {
          baseline++
          weightedBaseline += requirement.complexityWeight * card.stageWeights[i]
        }
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
  // Fix the original 18-area rubric total: a weight change is a documented
  // scope re-baseline, not a silent way to inflate delivery percentages.
  if(weightedTotal !== 1290) throw Error('COVERAGE_WEIGHT_TOTAL_CHANGED')
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
    weighted:{
      baseline:{points:weightedBaseline,totalPoints:weightedTotal,
        percent:pct(weightedBaseline,weightedTotal)},
      current:{points:weightedComplete,totalPoints:weightedTotal,
        percent:pct(weightedComplete,weightedTotal)},
      deltaPoints:pct(weightedComplete-weightedBaseline,weightedTotal)
    },
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
  '> Primary weighted engineering completion: **'+score.weighted.current.percent.toFixed(1)+
    '%**. Equal-checkpoint implementation coverage: **'+score.current.verified+'/'+
    score.current.total+' ('+score.current.percent.toFixed(1)+'%)** on '+
    card.currentMilestone+'. Strict commercial acceptance: **'+
    score.commercial.accepted+'/'+score.commercial.total+' ('+
    score.commercial.percent.toFixed(1)+'%)**.',
  '',
  '## Before / after',
  '',
  '| Metric | '+card.baseMilestone+' | '+card.currentMilestone+' | Delta |',
  '| --- | ---: | ---: | ---: |',
  '| Complexity-weighted engineering completion | '+score.weighted.baseline.percent.toFixed(1)+
    '% ('+score.weighted.baseline.points+'/'+score.weighted.baseline.totalPoints+') | '+
    score.weighted.current.percent.toFixed(1)+'% ('+score.weighted.current.points+'/'+
    score.weighted.current.totalPoints+') | +'+score.weighted.deltaPoints.toFixed(1)+' pp |',
  '| Equal-checkpoint implemented & evidenced | '+score.baseline.percent.toFixed(1)+'% ('+
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
  '- Primary completion multiplies documented original-area complexity by checkpoint acceptance effort (1, 2, 3, 4), with **no partial credit**.', 
  '- Equal-checkpoint coverage keeps exactly **1/72** per proof as a backward-compatible secondary metric; do not mix it with weighted completion.',
  '- A verified checkpoint requires an existing tracked code/test/specification file plus reviewed engineering evidence. Existence of a file alone is insufficient; CI independently validates executable artifacts.',
  '- Pending checkpoints do not count. In particular, hosted operations, real reviewed news, ten human participants and human visual approval are not silently assumed.',
  '- Weights are a documented planning rubric, **not measured engineering hours**; 100% requires all 72 independently accepted checkpoints.', 
  '- Neither indicator proves a commercially finished game or replaces external/human product sign-off.',
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
 return lines.join('\n') + weightedAppendix(card,score)
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

function weightedAppendix(card,score) {
 const lines=[
  '',
  '## Complexity-weighted engineering completion',
  '',
  '- **Primary weighted progress:** '+score.weighted.current.points+'/'+score.weighted.current.totalPoints+' = **'+score.weighted.current.percent.toFixed(1)+'%**.',
  '- Earlier AOS-052 baseline: '+score.weighted.baseline.points+'/'+score.weighted.baseline.totalPoints+' = '+score.weighted.baseline.percent.toFixed(1)+'%; AOS-053 genuine delta: +'+score.weighted.deltaPoints.toFixed(1)+' percentage points.',
  '- Every area has a stable complexity multiplier (4–12) and a written rationale below; stages 1–4 earn **1 / 2 / 3 / 4 effort units** respectively once evidence is verified.',
  '- Stage 1 covers the core foundation, stage 2 feature behavior, stage 3 cross-system integration, and stage 4 full operational/external acceptance. The original checkpoint descriptions are authoritative.',
  '- An unverified stage contributes zero. The rubric is an explicit comparative planning judgement, not logged work hours, a performance benchmark or an independently audited cost model.',
  '- Equal-checkpoint historical coverage stays '+score.current.verified+'/'+score.current.total+' = '+score.current.percent.toFixed(1)+'% for comparison; strict commercial signoff remains '+score.commercial.accepted+'/'+score.commercial.total+'. Changing weights alone does not credit any new requirement.',
  '',
  '| Original requirement | Complexity multiplier | Verified weighted points | Total weighted points | Completion | Rationale |',
  '| --- | ---: | ---: | ---: | ---: | --- |'
 ]
 for (const requirement of card.requirements) {
  const weight=requirement.complexityWeight
  const delivered=requirement.checkpoints.reduce((s,p,i)=>s+(p.state==='verified'?card.stageWeights[i]:0),0)*weight
  lines.push('| '+requirement.id+' | '+weight+' | '+delivered+' | '+(weight*10)+' | '+(delivered/weight/10*100).toFixed(1)+'% | '+requirement.complexityRationale+' |')
 }
 lines.push('','Weights are kept in `docs/development-coverage.json`, checked by CI, and must be explicitly re-baselined if the approved product scope changes.','')
 return lines.join('\n')
}
