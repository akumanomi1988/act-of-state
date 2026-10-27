import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolve } from 'node:path'
import {
  repoRoot,calculateDevelopmentCoverage,renderDevelopmentReport
} from '../scripts/development-progress.mjs'

const card=JSON.parse(readFileSync(resolve(repoRoot,'docs/development-coverage.json'),'utf8'))
const clone=()=>structuredClone(card)
const score=()=>calculateDevelopmentCoverage(card)

test('18 original requirements have 72 evidence-traced immutable checkpoint IDs',()=>{
 const result=score()
 assert.equal(card.requirements.length,18)
 assert.equal(result.current.total,72)
 assert.equal(result.current.verified,56)
 assert.equal(result.current.percent,77.8)
 assert.equal(card.schemaVersion,2)
 assert.deepEqual(card.stageWeights,[1,2,3,4])
 assert.deepEqual(result.weighted,{
  baseline:{points:782,totalPoints:1290,percent:60.6},
  current:{points:850,totalPoints:1290,percent:65.9},
  deltaPoints:5.3
 })
 assert.equal(result.baseline.verified,54)
 assert.equal(result.baseline.percent,75)
 assert.equal(result.deltaPoints,2.8)
 assert.equal(result.commercial.accepted,1)
 assert.equal(result.commercial.percent,5.6)
 assert.deepEqual(Object.keys(result.grouped).sort(),['F','T','V'])
 assert.equal(result.grouped.F.verified,25)
 assert.equal(result.grouped.T.verified,19)
 assert.equal(result.grouped.V.verified,12)
 assert.ok(result.finished.includes('MVP-F005.4'))
 assert.ok(result.finished.includes('MVP-V002.4'))
})
test('full commercial acceptance cannot credit a requirement with an open checkpoint',()=>{
 const altered=clone()
 altered.commercialAcceptance.complete=['MVP-T001','MVP-T003']
 assert.throws(()=>calculateDevelopmentCoverage(altered),
  /COVERAGE_COMMERCIAL_REQUIREMENT_INCOMPLETE/)
 const future=clone()
 future.commercialAcceptance.complete=['MVP-T003','MVP-F005']
 const upgraded=calculateDevelopmentCoverage(future)
 assert.equal(upgraded.commercial.accepted,2)
 assert.equal(upgraded.commercial.percent,11.1)
 const empty=clone()
 empty.commercialAcceptance.complete=[]
 assert.equal(calculateDevelopmentCoverage(empty).commercial.accepted,0)
})
test('complexity weights cannot be silently falsified or re-baselined',()=>{
 for(const mutate of [
  c=>{c.stageWeights=[1,2,3,0]},
  c=>{c.requirements[0].complexityWeight=0},
  c=>{c.requirements[0].complexityWeight++},
  c=>{c.requirements[0].complexityWeight=9;c.requirements[1].complexityWeight=6},
  c=>{c.requirements[0].complexityRationale='short'}
 ]) {
  const altered=clone();mutate(altered)
  assert.throws(()=>calculateDevelopmentCoverage(altered),/COVERAGE_(SCHEMA|REQUIREMENT|WEIGHT_TOTAL)_/)
 }
})
test('no points without code evidence, and duplicate requirements are rejected',()=>{
 const missing=clone()
 missing.requirements[0].checkpoints[0].proof='nonexistent/hidden-proof.ts'
 assert.throws(()=>calculateDevelopmentCoverage(missing),/COVERAGE_EVIDENCE_MISSING/)
 const duplicated=clone()
 duplicated.requirements[1].id='MVP-F001'
 assert.throws(()=>calculateDevelopmentCoverage(duplicated),/COVERAGE_REQUIREMENT_INVALID/)
})
test('pending or unexplained scores cannot inflate game implementation',()=>{
 const altered=clone()
 const pending=altered.requirements[0].checkpoints[3]
 pending.state='verified'
 pending.proof=null
 pending.creditedIn=card.currentMilestone
 assert.throws(()=>calculateDevelopmentCoverage(altered),/COVERAGE_EVIDENCE_MISSING/)
 pending.state='pending'
 pending.proof='src/App.tsx'
 pending.creditedIn=null
 assert.throws(()=>calculateDevelopmentCoverage(altered),/COVERAGE_UNVERIFIED_POINT/)
})
test('score distinguishes historical progress from current milestone and commercial acceptance',()=>{
 const altered=clone()
 const current=altered.requirements.find(x=>x.id==='MVP-V002').checkpoints[3]
 current.state='pending'
 current.proof=null
 current.creditedIn=null
 const result=calculateDevelopmentCoverage(altered)
 assert.equal(result.current.verified,55)
 assert.equal(result.current.percent,76.4)
 assert.equal(result.baseline.verified,54)
 assert.equal(result.deltaPoints,1.4)
 assert.equal(result.commercial.accepted,2)
})
test('rendered report has reproducible before/after and all traceable checkpoints',()=>{
 const report=renderDevelopmentReport(card,score())
 assert.match(report,/75\.0% \(54\/72\)/)
 assert.match(report,/77\.8% \(56\/72\)/)
 assert.match(report,/\+2\.8 pp/)
 assert.match(report,/5\.6%/)
 assert.match(report,/65\.9%/)
 assert.match(report,/Complexity-weighted engineering completion/)
 assert.equal((report.match(/\n\| MVP-/g)||[]).length,18)
 assert.match(report,/MVP-F005/)
 assert.match(report,/MVP-V002/)
 assert.equal((report.match(/\n### MVP-/g)||[]).length,18)
})
