import { cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import ServiceStatus from './ServiceStatus'

const good={
  schema:1,product:'act-of-state',commit:'f'.repeat(40),
  builtAt:'2026-10-25T20:00:00Z',
  models:{elections:'electoral-districts-v2',campaigns:'campaign-decay-v2'},
  routes:['/','/demo','/guide','/multiplayer','/editorial','/status']
}
const savedFetch=globalThis.fetch
beforeEach(()=>{
  vi.stubEnv('VITE_SUPABASE_URL','https://nwlxkqwbusrrldveijzb.supabase.co/')
  globalThis.fetch=vi.fn(async(url:RequestInfo|URL)=>{
    const target=String(url)
    if(target==='/release.json')return new Response(JSON.stringify(good),{
      status:200,headers:{'content-type':'application/json'}})
    if(target.endsWith('/auth/v1/health'))
      return new Response('{"healthy":true}',{status:200})
    throw new Error('Unexpected network target: '+target)
  }) as typeof fetch
})
afterEach(()=>{cleanup();globalThis.fetch=savedFetch;vi.unstubAllEnvs()})
describe('bilingual no-login status and release safety',()=>{
 it('displays limited public checks in English without extra privileged requests',async()=>{
  const original=window.location.href
  window.history.replaceState({},'','/status?lang=en')
  try{
   render(<ServiceStatus />)
   expect(screen.getByRole('heading',{name:'Game technical status'})).toBeInTheDocument()
   expect(screen.getByRole('link',{name:'Guide'})).toHaveAttribute('href','/guide?lang=en')
   const list=await screen.findByRole('list',{name:'Technical checks'})
   expect(within(list).getByText('Authentication endpoint reachable')).toBeInTheDocument()
   expect(within(list).getByText('Email delivery is not tested here.')).toBeInTheDocument()
   expect(screen.getByText(/not a test of your email delivery/i)).toBeInTheDocument()
   expect(screen.getByRole('link',{name:/Read recovery instructions/}))
    .toHaveAttribute('href','/guide?lang=en')
   fireEvent.click(screen.getByRole('button',{name:'Español'}))
   expect(new URLSearchParams(window.location.search).get('lang')).toBeNull()
   expect(screen.getByRole('heading',{name:'Estado técnico del juego'})).toBeInTheDocument()
   expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  } finally{window.history.replaceState({},'',original)}
 })
})

describe('public operational release diagnostics',()=>{
  it('identifies exact version and a separate, limited Auth endpoint check',async()=>{
    render(<ServiceStatus />)
    const container=await screen.findByRole('list',{name:'Comprobaciones técnicas'})
    expect(within(container).getByText('Revisión '+ 'f'.repeat(12))).toBeInTheDocument()
    expect(within(container).getByText('Endpoint de autenticación accesible')).toBeInTheDocument()
    expect(within(container).getByText('electoral-districts-v2')).toBeInTheDocument()
    expect(screen.getByText(/no certifica por sí solo el estado de la base/)).toBeInTheDocument()
    expect(screen.getByText(/La entrega real de correos no se comprueba aquí/)).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button',{name:'Comprobar de nuevo'}))
    await waitFor(()=>expect(globalThis.fetch).toHaveBeenCalledTimes(4))
  })
  it('fails visibly closed on stale/malformed asset and unreachable Auth',async()=>{
    globalThis.fetch=vi.fn(async(url:RequestInfo|URL)=>{
      if(String(url)==='/release.json')return new Response('not-json',{
        status:200,headers:{'content-type':'text/html'}})
      throw new Error('AUTH_NETWORK_DOWN')
    }) as typeof fetch
    render(<ServiceStatus />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se puede confirmar')
    expect(screen.getByText('Disponibilidad no verificada')).toBeInTheDocument()
    expect(screen.getByText('No verificable')).toBeInTheDocument()
    expect(screen.getByText(/no interpretes este resultado como una pérdida de tu partida/))
      .toBeInTheDocument()
  })
  it('explains missing Auth configuration without claiming a healthy API',async()=>{
    vi.stubEnv('VITE_SUPABASE_URL','')
    render(<ServiceStatus />)
    await screen.findByText('Disponibilidad no verificada')
    expect(screen.getByText('Identificada')).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
