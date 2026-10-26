import {describe, expect,it} from 'vitest'
import {parsePublicLanguage,publicRoute,updatePublicLanguage} from './publicLanguage'

describe('anonymous public language routing',()=>{
 it('defaults to Spanish for unknown or injected languages',()=>{
  expect(parsePublicLanguage('')).toBe('es')
  expect(parsePublicLanguage('?lang=de')).toBe('es')
  expect(parsePublicLanguage('?lang=en')).toBe('en')
  expect(parsePublicLanguage('?lang=es')).toBe('es')
 })
 it('propagates English only to supported anonymous paths',()=>{
  expect(publicRoute('/guide','en')).toBe('/guide?lang=en')
  expect(publicRoute('/demo','en')).toBe('/demo?lang=en')
  expect(publicRoute('/status','en')).toBe('/status?lang=en')
  expect(publicRoute('/guide','es')).toBe('/guide')
  expect(()=>publicRoute('/admin' as '/guide','en')).toThrow('UNSUPPORTED_PUBLIC_ROUTE')
 })
 it('keeps unrelated query arguments while switching the page language',()=>{
  const previous=window.location.href
  window.history.replaceState({},'', '/guide?draft=1&lang=en#calendar')
  try{
   updatePublicLanguage('es')
   expect(window.location.pathname).toBe('/guide')
   expect(window.location.search).toBe('?draft=1')
   expect(window.location.hash).toBe('#calendar')
   updatePublicLanguage('en')
   expect(window.location.search).toContain('lang=en')
   expect(window.location.search).toContain('draft=1')
  } finally{window.history.replaceState({},'',previous)}
 })
})
