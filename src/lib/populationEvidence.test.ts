import {describe,expect,it} from 'vitest'
import {validatePopulationProfile} from './population'
const legacy={modelVersion:'households-v1',households:300,sampleResidents:900,
  segments:[{dimension:'age',code:'young',households:90,residents:270,support:50,trust:50}]}
describe('versioned population evidence',()=>{
  it('accepts v1 legacy and v2 synthetic demographic models',()=>{
    expect(validatePopulationProfile(legacy)).toBe(true)
    expect(validatePopulationProfile({...legacy,modelVersion:'households-v2'})).toBe(true)
    expect(validatePopulationProfile({...legacy,modelVersion:'households-v3',sampleResidents:747})).toBe(true)
  })
  it('rejects unreviewed future demographic models and wrong totals',()=>{
    expect(validatePopulationProfile({...legacy,modelVersion:'households-v4'})).toBe(false)
    expect(validatePopulationProfile({...legacy,households:299})).toBe(false)
  })
})
