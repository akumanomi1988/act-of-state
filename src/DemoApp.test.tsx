import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import DemoApp from './DemoApp'
import { DEMO_STORAGE_KEY } from './demo/demoEngine'

beforeEach(() => window.localStorage.clear())
afterEach(() => { cleanup(); window.localStorage.clear() })

describe('guest sandbox complete gameplay', () => {
  it('offers playable onboarding without credentials and discloses isolation', () => {
    render(<DemoApp />)
    expect(screen.getByRole('heading', { name: 'Gobierna antes de registrarte.' })).toBeInTheDocument()
    expect(screen.getByText(/MODO DE ENSAYO, NO PARTIDA OFICIAL/)).toBeInTheDocument()
    expect(screen.getByText('0 / 4 expedientes')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Crear mi gobierno real' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: 'Revisar medida de prueba' })).toBeDisabled()
  })

  it('requires option selection and review before an authored effect is applied', () => {
    render(<DemoApp />)
    fireEvent.click(screen.getByRole('radio', { name: /Ayuda directa a familias/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar medida de prueba' }))
    expect(screen.getByRole('region', { name: 'Confirmación del ensayo' }))
      .toHaveTextContent('-1.200 M€')
    expect(screen.getByText('0 / 4 expedientes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar opción' }))
    expect(screen.getByText('0 / 4 expedientes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar medida de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar medida de prueba' }))
    expect(screen.getByText('1 / 4 expedientes')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ayuda directa a familias' })).toBeInTheDocument()
    expect(screen.getAllByText('6.800 M€').length).toBeGreaterThan(0)
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toContain('"caseId":"energy"')
    expect(screen.queryByRole('button', { name: 'Aplicar medida de prueba' })).not.toBeInTheDocument()
  })

  it('resumes browser-local progress on remount and allows another distinct case', () => {
    const first = render(<DemoApp />)
    fireEvent.click(screen.getByRole('radio', { name: /Ayuda directa a familias/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar medida de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar medida de prueba' }))
    first.unmount()
    render(<DemoApp />)
    expect(screen.getByText('1 / 4 expedientes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente expediente pendiente' }))
    expect(screen.getByRole('heading', { name: 'El acceso a la vivienda' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Agilizar licencias de obra/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar medida de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar medida de prueba' }))
    expect(screen.getByText('2 / 4 expedientes')).toBeInTheDocument()
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toContain('"caseId":"housing"')
  })

  it('uses a two-step reset and removes only the guest progress', () => {
    window.localStorage.setItem('unrelated-key', 'preserve')
    render(<DemoApp />)
    fireEvent.click(screen.getByRole('radio', { name: /Ayuda directa a familias/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar medida de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar medida de prueba' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar ensayo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByText('1 / 4 expedientes')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar ensayo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reiniciar ensayo' }))
    expect(screen.getByText('0 / 4 expedientes')).toBeInTheDocument()
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem('unrelated-key')).toBe('preserve')
    expect(screen.getByRole('heading', { name: 'Un invierno de precios elevados' })).toBeInTheDocument()
  })

  it('recovers from corrupt browser progress without rendering user data', () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
      version: 1, decisions: [{ caseId: 'injected', optionId: 'unknown' }]
    }))
    render(<DemoApp />)
    expect(screen.getByText('0 / 4 expedientes')).toBeInTheDocument()
  })
})
