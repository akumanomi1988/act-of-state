/**
 * Client-side UX checks only. GoTrue remains the password policy authority.
 * Never log, hash, persist, or send passwords outside the Auth API.
 */
export const MIN_PASSWORD_LENGTH = 12

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase()
}

export function newPasswordIssue(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH)
    return 'Utiliza una contraseña de al menos 12 caracteres.'
  if (password !== confirmation)
    return 'Las contraseñas no coinciden.'
  return null
}
