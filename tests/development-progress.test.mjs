import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { calculateProgress, validateProgress } from '../scripts/development-progress.mjs'
const load = () => JSON.parse(readFileSync(new URL('../data/development-progress.json', import.meta.url), 'utf8'))

test('unchanged original 18 requirements and four milestones per requirement', () => {
  const data = load()
  assert.equal(validateProgress(data),true)
  assert.deepEqual(data.requirements.map(x=>x.id),[
    'MVP-F001','MVP-F002','MVP-F003','MVP-F004','MVP-F005','MVP-F006','MVP-F007','MVP-F008',
    'MVP-T001','MVP-T002','MVP-T003','MVP-T004','MVP-T005','MVP-T006',
    'MVP-V001','MVP-V002','MVP-V003','MVP-V004'])
  assert.equal(data.requirements.flatMap(x=>x.checkpoints).length,72)
})
test('AOS-049 to AOS-052 exact pinned development baseline', () => {
  const result=calculateProgress(load())
  assert.deepEqual([result.main.completed,result.development.completed,result.gain.checkpoints],[52,56,4])
  assert.deepEqual([result.main.percent,result.development.percent,result.gain.points],[72.2,77.8,5.6])
  assert.deepEqual([result.acceptance.done,result.acceptance.total,result.acceptance.percent],[2,18,11.1])
})
test('invalid or unsupported checkpoint credit fails closed', () => {
  const data=load()
  data.requirements[0].development=5
  assert.throws(()=>calculateProgress(data),/Invalid checkpoint/)
  data.requirements[0].development=4
  data.requirements[0].evidence=[]
  assert.throws(()=>calculateProgress(data),/Invalid checkpoint/)
})
