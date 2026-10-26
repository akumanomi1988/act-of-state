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
 assert.equal(result.baseline.verified,54)
 assert.equal(result.baseline.percent,75)
 assert.equal(result.deltaPoints,2.8)
 assert.equal(result.commercial.accepted,2)
 assert.equal(result.commercial.percent,11.1)
 assert.deepEqual(Object.keys(result.grouped).sort(),['F','T','V'])
 assert.equal(result.grouped.F.verified,25)
 assert.equal(result.grouped.T.verified,19)
 assert.equal(result.grouped.V.verified,12)
 assert.ok(result.finished.includes('MVP-F005.4'))
 assert.ok(result.finished.includes('MVP-V002.4'))
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
 assert.match(report,/11\.1%/)
 assert.match(report,/MVP-F005/)
 assert.match(report,/MVP-V002/)
 assert.equal((report.match(/\n### MVP-/g)||[]).length,18)
})
