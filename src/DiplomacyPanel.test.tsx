import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DiplomacyPanel from './DiplomacyPanel'
const mocks=vi.hoisted(()=>({fetchDiplomacy:vi.fn()}))
vi.mock('./lib/diplomacy',()=>({fetchDiplomacy:mocks.fetchDiplomacy}))
const governmentId='test-government'
const bloc=(id:'europe'|'asia'|'usa',label:string,relation:number)=>({
  id,label,relation,tradeIndex:100,signedEffects:0
})
const state={governmentId,modelVersion:'diplomacy-v1',recentEffects:[],
  blocs:[bloc('europe','Europa',50),bloc('asia','Asia',50),
    bloc('usa','Estados Unidos',50)]}
const dossier=(id:string)=>({
  id,version:1,programme_chapter:'diplomacy' as const,
  title:'Tratado '+id,context:'Fiction',category:'Diplomacy',
  release_kind:'intro' as const,available_from:null,available_until:null
})
const dossiers=[dossier('diplomacy-europe'),dossier('diplomacy-asia'),dossier('diplomacy-usa')]
afterEach(()=>{cleanup();mocks.fetchDiplomacy.mockReset()})
describe('international diplomacy in cabinet and Parliament',()=>{
  it('shows authenticated state for all blocs and navigates to a treaty',async()=>{
    mocks.fetchDiplomacy.mockResolvedValue(state)
    const onSelect=vi.fn()
    render(<DiplomacyPanel governmentId={governmentId} identity="user-1"
      dossiers={dossiers} events={[]} mode="parliament" onSelect={onSelect} />)
    await screen.findAllByText('Índice comercial:',{exact:false})
    for(const zone of ['Europa','Asia','Estados Unidos'])
      expect(screen.getByRole('progressbar',{name:'Relación con '+zone}))
        .toHaveAttribute('aria-valuenow','50')
    fireEvent.click(screen.getAllByRole('button',{name:'Debatir tratado en el Parlamento'})[1])
    expect(onSelect).toHaveBeenCalledWith(dossiers[1])
  })
  it('reconciles an immutable signed act instead of predicting diplomacy',async()=>{
    mocks.fetchDiplomacy.mockResolvedValueOnce(state).mockResolvedValueOnce({
      ...state,blocs:[bloc('europe','Europa',64),...state.blocs.slice(1)],
      recentEffects:[{eventId:'signed',bloc:'europe',dossierId:'diplomacy-europe',
        optionId:'europe-social-treaty',title:'Pacto político con Europa',
        choice:'Tratado de movilidad social',relationDelta:14,tradeDelta:2,
        signedAt:'2026-10-26T09:00:00Z'}]
    })
    const onSelect=vi.fn()
    const props={governmentId,identity:'user-1',dossiers,events:[],
      mode:'solo' as const,onSelect}
    const {rerender}=render(<DiplomacyPanel {...props}/>)
    await screen.findAllByText('50/100')
    rerender(<DiplomacyPanel {...props} events={[{
      id:'signed',dossier_id:'diplomacy-europe',dossier_version:1,
      option_id:'europe-social-treaty',government_id:governmentId,
      dossier_title_snapshot:'Pacto',option_title_snapshot:'Tratado',
      engine_version:'weighted-cohorts-v1',decided_on:'2026-10-26',
      created_at:'2026-10-26T09:00:00Z',cohort_effects:[],
      state_before:{treasury_m_eur:12000,approval:50,trust:50},
      state_after:{treasury_m_eur:11560,approval:51,trust:52},
      parameters_snapshot:{treasury_delta_m_eur:-440,policy_target:30,
        response_intensity:31,trust_base_delta:4}
    }]}/>)
    await screen.findByText('64/100')
    expect(screen.getByText('Consultar acuerdo firmado')).toBeInTheDocument()
    expect(mocks.fetchDiplomacy).toHaveBeenCalledTimes(2)
  })
  it('does not leak prior nation relations after identity changes',async()=>{
    let resolve!: (x:typeof state)=>void
    mocks.fetchDiplomacy.mockReturnValueOnce(new Promise(r=>{resolve=r}))
      .mockResolvedValueOnce(state)
    const onSelect=vi.fn()
    const {rerender}=render(<DiplomacyPanel governmentId={governmentId}
      identity="first" dossiers={dossiers} events={[]} mode="solo" onSelect={onSelect}/>)
    rerender(<DiplomacyPanel governmentId={governmentId}
      identity="second" dossiers={dossiers} events={[]} mode="solo" onSelect={onSelect}/>)
    resolve({...state,governmentId})
    await screen.findAllByText('50/100')
    await waitFor(()=>expect(mocks.fetchDiplomacy).toHaveBeenCalledTimes(2))
  })
  it('does not claim version-one treaties signed by an unrelated later version',async()=>{
    mocks.fetchDiplomacy.mockResolvedValue(state)
    render(<DiplomacyPanel governmentId={governmentId} identity="user-1"
      dossiers={dossiers} events={[{
        id:'old-act',dossier_id:'diplomacy-europe',dossier_version:2
      }] as never} mode="solo" onSelect={vi.fn()} />)
    await screen.findAllByText('Índice comercial:',{exact:false})
    expect(screen.getAllByRole('button',{name:'Negociar expediente'})).toHaveLength(3)
    expect(screen.queryByRole('button',{name:'Consultar acuerdo firmado'})).toBeNull()
  })

})

