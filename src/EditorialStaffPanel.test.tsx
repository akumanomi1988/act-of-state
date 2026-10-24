import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import EditorialStaffPanel from './EditorialStaffPanel'

const mocked=vi.hoisted(()=>({list:vi.fn(),manage:vi.fn()}))
vi.mock('./lib/editorialOperations',()=>({
 fetchEditorialStaff:mocked.list,manageEditorialStaff:mocked.manage
}))
vi.mock('./lib/editorial',()=>({ editorialError:(reason:unknown)=>String(reason) }))
beforeEach(()=>{
 vi.clearAllMocks()
 mocked.list.mockResolvedValue([{user_id:'p1',email:'boss@example.test',role:'publisher'}])
 mocked.manage.mockResolvedValue(undefined)
})
afterEach(cleanup)
describe('publisher newsroom staff controls',()=>{
 it('adds an editor and refreshes confirmed staff list',async()=>{
  render(<EditorialStaffPanel identity="p1"/>)
  fireEvent.click(screen.getByText('Administrar equipo editorial'))
  expect(await screen.findByText(/boss@example.test/)).toBeInTheDocument()
  fireEvent.change(screen.getByRole('textbox',{name:'Correo de la cuenta'}),
   {target:{value:'editor@example.test'}})
  fireEvent.click(screen.getByRole('button',{name:'Asignar rol'}))
  await waitFor(()=>expect(mocked.manage).toHaveBeenCalledWith(
   'editor@example.test','editor'))
  expect(await screen.findByText(/Permisos editoriales actualizados/))
   .toBeInTheDocument()
 })
 it('does not report success after a rejected privilege mutation',async()=>{
  mocked.manage.mockRejectedValue(new Error('EDITORIAL_LAST_PUBLISHER'))
  render(<EditorialStaffPanel identity="p1"/>)
  fireEvent.click(screen.getByText('Administrar equipo editorial'))
  await screen.findByText(/boss@example.test/)
  fireEvent.click(screen.getByRole('button',{name:'Revocar'}))
  await waitFor(()=>expect(screen.getByRole('alert'))
   .toHaveTextContent('EDITORIAL_LAST_PUBLISHER'))
  expect(screen.queryByText(/Permisos editoriales actualizados/)).toBeNull()
 })
})
