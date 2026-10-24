import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import ActionInboxPanel from './ActionInboxPanel'
const mocks=vi.hoisted(()=>({fetch:vi.fn(),read:vi.fn()}))
vi.mock('./lib/actionInbox',()=>({
 fetchActionInbox:mocks.fetch,markInboxRead:mocks.read
}))
vi.mock('./lib/multiplayer',()=>({
 matchError:(reason:unknown)=>reason instanceof Error?reason.message:String(reason)
}))
const mid='98000000-0000-4000-8000-000000000001'
const pending={key:'parliament:bill-1',kind:'action',section:'parliament',
 title:'Votación parlamentaria pendiente',detail:'Expediente climático',
 dossierId:'climate-2026',read:false}
const news={key:'friday:2026-10-19',kind:'news',section:'history',
 title:'Acta semanal certificada',detail:'Cierre financiero oficial.',
 dossierId:null,read:true}
const onNavigate=vi.fn()
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.fetch.mockResolvedValue({matchId:mid,serverDay:'2026-10-24',
  unreadCount:1,items:[pending,news]})
 mocks.read.mockResolvedValue(undefined)
})
afterEach(cleanup)
describe('personal multiplayer political inbox',()=>{
 it('renders pending action and certifiable weekly news',async()=>{
  render(<ActionInboxPanel matchId={mid} onNavigate={onNavigate}/>)
  expect(await screen.findByText('Votación parlamentaria pendiente')).toBeInTheDocument()
  expect(screen.getByLabelText('Avisos sin leer')).toHaveTextContent('1 sin leer')
  expect(screen.getByText('Acta semanal certificada')).toBeInTheDocument()
  expect(screen.getAllByRole('button',{name:'Ir al asunto'})).toHaveLength(2)
 })
 it('filters read items, selects the matching dossier and marks receipt after confirmation',async()=>{
  render(<ActionInboxPanel matchId={mid} onNavigate={onNavigate}/>)
  await screen.findByText('Votación parlamentaria pendiente')
  fireEvent.click(screen.getByRole('checkbox',{name:'Mostrar solo avisos sin leer'}))
  expect(screen.queryByText('Acta semanal certificada')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Ir al asunto'}))
  expect(onNavigate).toHaveBeenCalledWith('parliament','climate-2026')
  fireEvent.click(screen.getByRole('button',{name:'Marcar leído'}))
  await waitFor(()=>expect(mocks.read).toHaveBeenCalledWith(mid,pending.key))
  await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledTimes(2))
 })
 it('reports server rejection without marking a pending item as read',async()=>{
  mocks.read.mockRejectedValueOnce(new Error('MATCH_FORBIDDEN'))
  render(<ActionInboxPanel matchId={mid} onNavigate={onNavigate}/>)
  await screen.findByText('Votación parlamentaria pendiente')
  fireEvent.click(screen.getByRole('button',{name:'Marcar leído'}))
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('MATCH_FORBIDDEN'))
  expect(screen.getByRole('button',{name:'Marcar leído'})).toBeInTheDocument()
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
 })
})
