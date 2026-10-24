import {useEffect,useState,type FormEvent} from 'react'
import {fetchEditorialStaff,manageEditorialStaff,type EditorialStaff} from './lib/editorialOperations'
import {editorialError,type EditorialRole} from './lib/editorial'

export default function EditorialStaffPanel({identity}:{identity:string}) {
 const [staff,setStaff]=useState<EditorialStaff[]>([])
 const [email,setEmail]=useState('')
 const [role,setRole]=useState<EditorialRole>('editor')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 useEffect(()=>{
  let alive=true
  setStaff([]);setError('');setNotice('')
  void fetchEditorialStaff().then(value=>{if(alive)setStaff(value)})
   .catch(e=>{if(alive)setError(editorialError(e))})
  return ()=>{alive=false}
 },[identity])
 async function change(emailValue:string,roleValue:EditorialRole|null) {
  if(busy)return
  setBusy(true);setError('');setNotice('')
  try {
   await manageEditorialStaff(emailValue,roleValue)
   setStaff(await fetchEditorialStaff())
   setNotice('Permisos editoriales actualizados y registrados.')
   setEmail('')
  } catch(e) {setError(editorialError(e))}
  finally {setBusy(false)}
 }
 function submit(event:FormEvent<HTMLFormElement>) {
  event.preventDefault()
  if(email.trim())void change(email,role)
 }
 return <details className="editorial-staff-panel">
  <summary>Administrar equipo editorial</summary>
  <p className="muted">Solo el publicador puede gestionar los accesos.
    Las cuentas deben estar registradas y tener su correo confirmado.
    El último publicador no puede ser retirado.</p>
  <form className="editorial-staff-form" onSubmit={submit}>
   <label>Correo de la cuenta
    <input type="email" required value={email} disabled={busy}
      onChange={event=>setEmail(event.target.value)}/></label>
   <label>Rol
    <select aria-label="Nuevo rol editorial" value={role}
      onChange={event=>setRole(event.target.value as EditorialRole)} disabled={busy}>
     <option value="editor">Editor</option>
     <option value="publisher">Publicador</option>
    </select></label>
   <button type="submit" disabled={busy}>Asignar rol</button>
  </form>
  <ul className="editorial-staff-list">{staff.map(person=><li key={person.user_id}>
   <span>{person.email} · {person.role==='publisher'?'Publicador':'Editor'}</span>
   <button type="button" disabled={busy}
     onClick={()=>void change(person.email,null)}>Revocar</button>
  </li>)}</ul>
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert">{error}</p>}
 </details>
}
