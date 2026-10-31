import assert from 'node:assert/strict'
import { test } from 'node:test'

// Numerical oracle independent of PostgreSQL seed implementation.
// INE source register and limitations: docs/POPULATION_CALIBRATION_REVIEW.md
const rows=Array.from({length:300},(_,index)=>{
 const n=index+1,a=(n*37+11)%300,i=(n*71+29)%300;
 const s=(n*83+23)%300,z=(n*127+5)%300,d=(n-1)%100;
 return {n,
  residents:z<85?1:z<172?2:z<232?3:z<264?4:5,
  age:a<62?'young':a<223?'working':'senior',
  income:i<60?'low':i<240?'middle':'high',
  settlement:s<241?'urban':'rural',
  district:d<25?'capital':d<45?'industrial':d<63?'coastal':d<78?'agrarian':d<90?'highland':'frontier',
  cohort:((n-1)*29+7)%100<65?'households':'industry'}
});
const count=key=>Object.fromEntries([...new Set(rows.map(x=>x[key]))]
 .map(k=>[k,rows.filter(x=>x[key]===k).length]));

test('INE 2026 household-size mix and observed 2.49 weighted mean',()=>{
 assert.deepEqual(count('residents'),{'1':85,'2':87,'3':60,'4':32,'5':36});
 assert.equal(rows.reduce((a,h)=>a+h.residents,0),747);
 const measured=[5620017,5732736,3916320,4490276],total=measured.reduce((a,b)=>a+b);
 [85,87,60,68].forEach((n,i)=>assert.ok(Math.abs(n/300-measured[i]/total)<0.003))
});
test('2025 adult-resident and municipality source proxy margins',()=>{
 assert.deepEqual(count('age'),{young:62,working:161,senior:77});
 assert.deepEqual(count('settlement'),{urban:241,rural:59});
 assert.deepEqual(count('income'),{low:60,middle:180,high:60});
 assert.deepEqual(count('cohort'),{households:195,industry:105})
});
test('all 9 cross-cells and every synthetic constituency remain balanced',()=>{
 const age=count('age'),income=count('income'),districts=count('district');
 for(const a in age)for(const i in income){
  const actual=rows.filter(h=>h.age===a&&h.income===i).length;
  assert.ok(actual>0&&Math.abs(actual-age[a]*income[i]/300)<=3,a+'/'+i)
 }
 assert.equal(Object.keys(districts).length,6);
 for(const district in districts){
  const sample=rows.filter(h=>h.district===district);
  for(const field of ['age','income','settlement','cohort'])
   assert.ok(new Set(sample.map(h=>h[field])).size>=2,district+' missing '+field);
  assert.ok(Math.abs(sample.filter(h=>h.cohort==='households').length-districts[district]*.65)<=3)
 }
});
test('polarized and five-party counterfactuals preserve normalized shares',()=>{
 function vote(platforms){
  const total=platforms.map(()=>0);
  for(const h of rows){
   const ideal=h.cohort==='households'?25:75;
   const preference=Math.max(0,Math.min(100,ideal+(h.n*19)%41-20+
     (h.income==='high'?8:h.income==='low'?-8:0)+(h.settlement==='rural'?4:0)));
   const scores=platforms.map(p=>Math.max(1,100-2*Math.abs(preference-p)));
   const divisor=scores.reduce((a,b)=>a+b);
   scores.forEach((score,i)=>{total[i]+=h.residents*score/divisor})
  }
  const mass=total.reduce((a,b)=>a+b);
  return total.map(x=>x/mass)
 }
 for(const platforms of [[0,100],[25,75],[50,50],[0,25,50,75,100]]){
  const shares=vote(platforms);
  assert.ok(shares.every(x=>Number.isFinite(x)&&x>0&&x<1));
  assert.ok(Math.abs(shares.reduce((a,b)=>a+b)-1)<1e-12)
 }
 assert.ok(Math.abs(vote([25,75])[0]-vote([75,25])[1])<1e-12)
});
