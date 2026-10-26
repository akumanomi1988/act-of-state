import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import { AccountPasswordPanel,PasswordSignIn } from './PasswordAccess'

const mocks=vi.hoisted(()=>({
  signInWithPassword:vi.fn(),
  resetPasswordForEmail:vi.fn(),
  updateUser:vi.fn(),
  signInWithOtp:vi.fn()
}))
vi.mock('./lib/game',()=>({
  client:{auth:{
    signInWithPassword:mocks.signInWithPassword,
    resetPasswordForEmail:mocks.resetPasswordForEmail,
    updateUser:mocks.updateUser,
    signInWithOtp:mocks.signInWithOtp
  }}
}))
beforeEach(()=>{
  vi.resetAllMocks()
  mocks.signInWithPassword.mockResolvedValue({data:{user:{id:'unchanged'}},error:null})
  mocks.resetPasswordForEmail.mockResolvedValue({data:{},error:null})
  mocks.updateUser.mockResolvedValue({data:{user:{id:'unchanged'}},error:null})
})
afterEach(()=>cleanup())

describe('password-based access to the same Supabase account',()=>{
  it('authenticates through GoTrue password without issuing a mail link',async()=>{
    const onError=vi.fn(),onEmail=vi.fn()
    const {rerender}=render(<PasswordSignIn
      email="  User@Example.Invalid " onEmailChange={onEmail}
      onError={onError} redirectTo="http://localhost:4173/" />)
    fireEvent.change(screen.getByLabelText('Contraseña'),{
      target:{value:'long secret phrase'}
    })
    fireEvent.click(screen.getByRole('button',{name:'Entrar con contraseña'}))
    await waitFor(()=>expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email:'user@example.invalid',password:'long secret phrase'
    }))
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
    rerender(<PasswordSignIn
      email="  User@Example.Invalid " onEmailChange={onEmail}
      onError={onError} redirectTo="http://localhost:4173/" />)
    await waitFor(()=>expect(screen.getByLabelText('Contraseña')).toHaveValue(''))
  })

  it('reports failed credentials without distinguishing unknown accounts',async()=>{
    mocks.signInWithPassword.mockResolvedValue({data:null,error:{code:'invalid_credentials'}})
    const onError=vi.fn()
    render(<PasswordSignIn email="missing@example.invalid"
      onEmailChange={vi.fn()} onError={onError}
      redirectTo="http://localhost:4173/" />)
    fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'nope'}})
    fireEvent.click(screen.getByRole('button',{name:'Entrar con contraseña'}))
    await waitFor(()=>expect(onError).toHaveBeenCalledWith(expect.stringMatching(
      /Revisa el correo y la contraseña/)))
  })

  it('only sends a reset email after explicit request with a generic response',async()=>{
    render(<PasswordSignIn email="user@example.invalid"
      onEmailChange={vi.fn()} onError={vi.fn()}
      redirectTo="https://example.invalid/multiplayer" />)
    fireEvent.click(screen.getByRole('button',{name:'He olvidado mi contraseña'}))
    await waitFor(()=>expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.invalid',{redirectTo:'https://example.invalid/multiplayer'}))
    expect(await screen.findByText(/Si existe una cuenta/)).toBeInTheDocument()
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('sets a strong password on the authenticated existing UUID, never creates a new user',async()=>{
    render(<AccountPasswordPanel />)
    fireEvent.click(screen.getByText('Configurar contraseña de acceso'))
    fireEvent.change(screen.getByLabelText('Nueva contraseña'),
      {target:{value:'correct long password'}})
    fireEvent.change(screen.getByLabelText('Repite la contraseña'),
      {target:{value:'correct long password'}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar contraseña'}))
    await waitFor(()=>expect(mocks.updateUser).toHaveBeenCalledWith(
      {password:'correct long password'}))
    expect(await screen.findByText(/Contraseña guardada/)).toBeInTheDocument()
    expect(mocks.signInWithOtp).not.toHaveBeenCalled()
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched setup and preserves backend recent-login checks',async()=>{
    render(<AccountPasswordPanel />)
    fireEvent.click(screen.getByText('Configurar contraseña de acceso'))
    fireEvent.change(screen.getByLabelText('Nueva contraseña'),
      {target:{value:'correct long password'}})
    fireEvent.change(screen.getByLabelText('Repite la contraseña'),
      {target:{value:'wrong long password'}})
    fireEvent.click(screen.getByRole('button',{name:'Guardar contraseña'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('no coinciden')
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })
})
