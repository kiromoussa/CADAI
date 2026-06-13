import { describe, expect, it } from 'vitest'
import {
  municipalCodeBodiesForCity,
  municipalCodeBodiesForJurisdiction,
} from '@/lib/analysis/code-bodies'

describe('municipal code bodies', () => {
  it('returns LA municipal code bodies for Los Angeles', () => {
    const bodies = municipalCodeBodiesForCity('Los Angeles', 'CA')
    expect(bodies).toContain('Los Angeles Municipal Code')
    expect(bodies).toContain('Los Angeles Building Code')
    expect(bodies).toContain('Los Angeles Residential Code')
    expect(bodies.length).toBeGreaterThanOrEqual(4)
  })

  it('returns Santa Ana municipal code only for Santa Ana', () => {
    expect(municipalCodeBodiesForCity('Santa Ana', 'CA')).toEqual([
      'Santa Ana Municipal Code',
    ])
    expect(municipalCodeBodiesForCity('Irvine', 'CA')).toEqual([])
  })

  it('maps los_angeles_ca slug to full LA code set', () => {
    const bodies = municipalCodeBodiesForJurisdiction('los_angeles_ca')
    expect(bodies).toContain('Los Angeles Municipal Code')
    expect(bodies).toContain('Los Angeles Plumbing Code')
  })
})
