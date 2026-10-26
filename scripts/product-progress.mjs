#!/usr/bin/env node
import {readFileSync,existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const read=p=>JSON.parse(readFileSync(path.join(base,p),'utf8'))
const whole=read('docs/product-completion.json')
const functional=read('docs/functional-acceptance.json')
const fail=m=>{throw Error('COMPLETION_CONTRACT: '+m)}
if(whole.immutableTotalWeight!==100 || functional.parentFunctionalWeight!==62)
 fail('frozen denominator changed')
const keys=new Set(),gates=new Map(whole.criteria.map(g=>[g.id,g]))
for(const group of functional.groups){
 const parent=gates.get(group.id)
 if(!parent||!group.id.startsWith('MVP-F')||parent.weight!==group.weight)
  fail('unknown group or reweight '+group.id)
 if(group.criteria.reduce((n,c)=>n+c.weight,0)!==group.weight)
  fail('group subtotal '+group.id)
 for(const c of group.criteria){
  if(keys.has(c.id))fail('duplicate criterion '+c.id)
  keys.add(c.id)
  if(typeof c.accepted!=='boolean'||!Number.isInteger(c.weight)||c.weight<=0)
   fail('invalid criterion '+c.id)
  if(c.accepted){
   if(!c.evidence?.test||!existsSync(path.join(base,c.evidence.test))||
     !functional.evidence[c.evidence.run])
     fail('accepted without reproducible evidence '+c.id)
  } else if(c.evidence!==null)fail('unaccepted criterion has misleading proof '+c.id)
 }
}
if(functional.groups.length!==8||keys.size!==24)fail('changed scope; version baseline explicitly')
const claimed=functional.groups.reduce((n,g)=>n+g.criteria.reduce((m,c)=>m+(c.accepted?c.weight:0),0),0)
const accepted=whole.criteria.reduce((n,c)=>n+(c.accepted?c.weight:0),0)
const result={acceptedWholeProductPoints:accepted,wholeProductWeight:100,technicalFunctionalEvidencePoints:claimed,functionalScopeWeight:62,functionalEvidencePercent:Math.round(claimed/62*1000)/10,commercialAcceptancePercent:accepted,unverifiedFunctionalPoints:62-claimed,
 humanOrExternalCriteria:functional.groups.flatMap(g=>g.criteria.filter(c=>!c.accepted).map(c=>({id:c.id,name:c.name,weight:c.weight})))}
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2))
else console.log('Whole-product acceptance: '+accepted+'/100; documented functional acceptance: '+claimed+'/62 ('+result.functionalEvidencePercent+'%); external gates unchanged.')
