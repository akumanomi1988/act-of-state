import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import test from 'node:test'
const run=()=>spawnSync(process.execPath,['scripts/product-progress.mjs','--json'],{encoding:'utf8'})
test('frozen technical-feature subcriteria are distinct, weighted and evidenced',()=>{
 const parent=JSON.parse(readFileSync(new URL('../docs/product-completion.json',import.meta.url)))
 const child=JSON.parse(readFileSync(new URL('../docs/functional-acceptance.json',import.meta.url)))
 assert.equal(parent.criteria.filter(c=>c.id.startsWith('MVP-F')).reduce((n,c)=>n+c.weight,0),62)
 assert.equal(child.groups.length,8)
 assert.equal(child.groups.reduce((n,g)=>n+g.weight,0),62)
 assert.equal(child.groups.flatMap(g=>g.criteria).length,24)
 const res=run()
 assert.equal(res.status,0,res.stderr)
 const result=JSON.parse(res.stdout)
 assert.equal(result.acceptedWholeProductPoints,23)
 assert.equal(result.technicalFunctionalEvidencePoints+result.unverifiedFunctionalPoints,62)
 assert(result.humanOrExternalCriteria.length>0)
})
