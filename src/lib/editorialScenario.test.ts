import {describe,it,expect} from 'vitest'
import {editorialReady,newEditorialDossier} from './editorial'
import {draftPolicyScenario,preparePolicyScenarios} from './editorialScenario'

function cited(category='Economía') {
 return {...newEditorialDossier('2026-10-26',1),title:'Debate sobre política energética',
  category,source_url:'https://elpais.com/noticias/energia',
  source_title:'Referencia de política energética publicada',
  source_published_at:new Date(Date.now()-3600000).toISOString()}
}
describe('AOS-035 deterministic editorial scenario authoring',()=>{
 it('creates a fictional scenario with three distinct playable policy choices',()=>{
  const result=draftPolicyScenario(cited())
  expect(result.context).toMatch(/hipotético/)
  expect(result.context).toMatch(/no afirmaciones sobre medidas reales/)
  expect(result.options).toHaveLength(3)
  expect(new Set(result.options.map(o=>o.policy_target)).size).toBe(3)
  expect(result.options[0].treasury_delta_m_eur).toBe(-1200)
  expect(result.options[2].treasury_delta_m_eur).toBe(0)
  expect(editorialReady(result)).toBe(true)
 })
 it('does not invent sources or overwrite authored policy effects',()=>{
  const noSource=newEditorialDossier('2026-10-26',1)
  expect(draftPolicyScenario(noSource)).toBe(noSource)
  const edited={...cited('Instituciones'),context:'Custom verified account of a historical event',
   options:[{...cited().options[0],title:'Custom proposal',description:'Unique published position'}]}
  expect(draftPolicyScenario(edited)).toBe(edited)
 })
 it('fills only sourced incomplete dossiers and remains idempotent',()=>{
  const original=[cited('Relaciones exteriores'),newEditorialDossier('2026-10-26',2)]
  const first=preparePolicyScenarios(original)
  expect(first.updated).toBe(1)
  expect(first.draft[0].options[0].treasury_delta_m_eur).toBe(-650)
  expect(first.draft[1]).toBe(original[1])
  const repeated=preparePolicyScenarios(first.draft)
  expect(repeated.updated).toBe(0)
  expect(repeated.draft[0]).toBe(first.draft[0])
 })
})
