import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const b=JSON.parse(readFileSync(new URL('../docs/product-completion.json',import.meta.url)))
test('frozen whole-product completion weights and distinct criteria',()=>{
  assert.equal(b.immutableTotalWeight,100)
  assert.equal(b.criteria.length,18)
  assert.equal(new Set(b.criteria.map(c=>c.id)).size,18)
  assert.equal(b.criteria.reduce((sum,c)=>sum+c.weight,0),100)
  assert(b.criteria.every(c=>c.weight>0&&typeof c.accepted==='boolean'))
})
test('accepted score is evidenced not inferred from code volume',()=>{
  const accepted=b.criteria.filter(c=>c.accepted)
  assert(accepted.every(c=>c.evidence))
  assert.deepEqual(accepted.map(c=>c.id),['MVP-T001','MVP-T002','MVP-T003','MVP-T004','MVP-T005'])
  assert.equal(accepted.reduce((sum,c)=>sum+c.weight,0),23)
})

