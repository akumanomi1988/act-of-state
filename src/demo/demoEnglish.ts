import { DEMO_CASES, type DemoCase } from './demoEngine'

const english = {
 energy: { category:'Energy', title:'A winter of soaring prices', context:'In the fictional Republic of Arcadia, households face expensive energy bills while manufacturers warn that rising costs could disrupt production.',
  choices:{ aid:['Direct assistance to families','Subsidize energy bills, prioritizing vulnerable households.'], grid:['Invest in the electricity network','An infrastructure investment with slow returns but greater industrial resilience.'], market:['Leave market prices unchanged','Preserve the budget while accepting greater social pressure.'] }},
 housing:{ category:'Housing', title:'Access to affordable housing', context:'Young people demand affordable rental housing. Developers want fewer regulatory obstacles to building new homes.',
  choices:{ public:['Build public rental homes','Fund the construction of affordable public rental properties.'], licenses:['Accelerate building permits','Simplify permit procedures to encourage private construction.'], rent:['Temporary rental assistance','Deliver rapid support at an illustrative recurring fiscal cost.'] }},
 water:{ category:'Territory', title:'Water reserves near critical levels', context:'A fictional drought forces the government to weigh drinking-water security, agricultural needs and fiscal sustainability.',
  choices:{ reservoir:['Modernize water infrastructure','Reduce network leakage and reinforce emergency reserves.'], ration:['Restrict water consumption','Protect supply by imposing temporary consumption limits.'], subsidy:['Compensate agricultural producers','Provide immediate support to the agricultural sector.'] }},
 health:{ category:'Public services', title:'Growing healthcare waiting lists', context:'Medical waiting times are increasing. Public budgets have limited resources for the next fictional fiscal year.',
  choices:{ staff:['Increase healthcare staffing','Hire additional medical staff and extend operating hours.'], digital:['Modernize scheduling and management','Prioritize new booking systems and reorganize patient care.'], freeze:['Freeze new expenditure','Avoid new allocations, accepting slower improvements in access.'] }}
} as const

/** Presentation-only English layer. IDs, fiscal effects and saved decisions are untouched. */
export function demoCasesFor(language:'es'|'en'):readonly DemoCase[] {
 if(language==='es') return DEMO_CASES
 return DEMO_CASES.map(entry=>{
  const content=english[entry.id as keyof typeof english]
  if(!content)throw Error('DEMO_TRANSLATION_MISSING_CASE')
  return {...entry,category:content.category,title:content.title,context:content.context,
   choices:entry.choices.map(choice=>{
    const words=(content.choices as Record<string,readonly [string,string]>)[choice.id]
    if(!words)throw Error('DEMO_TRANSLATION_MISSING_CHOICE')
    return {...choice,title:words[0],description:words[1]}
   })}
 })
}
