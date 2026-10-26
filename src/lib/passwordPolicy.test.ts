import { describe,expect,it } from 'vitest'
import {MIN_PASSWORD_LENGTH,normalizeEmail,newPasswordIssue} from './passwordPolicy'

describe('client password UX constraints (Supabase is authoritative)',()=>{
  it('normalizes only the mailbox, never the password',()=>{
    expect(normalizeEmail('  Player@Example.COM  ')).toBe('player@example.com')
    expect(newPasswordIssue('M!yPassword Long','M!yPassword Long')).toBeNull()
  })
  it('requires twelve characters and an exact repeated password',()=>{
    expect(MIN_PASSWORD_LENGTH).toBe(12)
    expect(newPasswordIssue('short','short')).toMatch(/12 caracteres/)
    expect(newPasswordIssue('longpassphrase','longpassphrase2')).toMatch(/no coinciden/)
    expect(newPasswordIssue('longpassphrase','longpassphrase')).toBeNull()
  })
})
