import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import MobileDetailNavigation from './MobileDetailNavigation'

afterEach(cleanup)
describe('accessible mobile information drilldown',()=>{
  it('identifies the active section and never executes a game command',()=>{
    const choose=vi.fn()
    const props={label:'Apartados de Mi país',value:'overview' as 'overview'|'people',
      tabs:[{id:'overview',label:'Resumen'},{id:'people',label:'Población'}] as const,
      onChange:choose}
    const {rerender}=render(<MobileDetailNavigation {...props}/>)
    const nav=screen.getByRole('navigation',{name:'Apartados de Mi país'})
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(screen.getByRole('button',{name:'Resumen'})).toHaveAttribute('aria-current','page')
    fireEvent.click(screen.getByRole('button',{name:'Población'}))
    expect(choose).toHaveBeenCalledExactlyOnceWith('people')
    rerender(<MobileDetailNavigation {...props} value="people"/>)
    expect(screen.getByRole('button',{name:'Población'})).toHaveAttribute('aria-current','page')
    expect(screen.getByRole('button',{name:'Resumen'})).not.toHaveAttribute('aria-current')
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
  })
})
