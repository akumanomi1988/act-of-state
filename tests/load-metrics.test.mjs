import test from 'node:test'
import assert from 'node:assert/strict'
import {percentile,loadReceipt} from './load-metrics.mjs'
test('p95 is nearest-rank over independent measured elapsed request times',()=>{
 assert.equal(percentile([20,4,16,12,8]),20)
 assert.equal(percentile([1,2,3,4,5,6,7,8,9,10],50),5)
 assert.equal(percentile([1,2,3,4,5,6,7,8,9,10],95),10)
 assert.deepEqual([10,1,5], [10,1,5])
})
test('never reports failing loads as passing, even if p95 is small',()=>{
 const x=loadReceipt([5,10,15,20],1,{ceilingMs:100})
 assert.equal(x.failed,1)
 assert.equal(x.withinBudget,false)
 assert.equal(x.p95Ms,20)
})
test('rejects invented metrics, empty samples and invalid budgets',()=>{
 for(const a of [[],[NaN],[Infinity],[-1],undefined])
  assert.throws(()=>percentile(a),/LOAD_METRICS_INVALID_INPUT/)
 assert.throws(()=>loadReceipt([10],0,{ceilingMs:0}),/LOAD_BUDGET_INVALID/)
})
