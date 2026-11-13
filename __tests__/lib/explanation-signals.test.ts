import { formatExplanationSignalValue } from '@/lib/explanation-signals'

describe('formatExplanationSignalValue', () => {
  it.each([
    ['low', 'Bajo', 'Low'],
    ['medium', 'Medio', 'Medium'],
    ['high', 'Alto', 'High'],
  ])('localizes the raw risk level "%s"', (raw, es, en) => {
    expect(formatExplanationSignalValue(raw, true)).toBe(es)
    expect(formatExplanationSignalValue(raw, false)).toBe(en)
  })

  it('never exposes the raw enum literal in Spanish', () => {
    for (const raw of ['low', 'medium', 'high', ' LOW ']) {
      expect(formatExplanationSignalValue(raw, true)).not.toMatch(/low|medium|high/i)
    }
  })

  it('keeps already human-readable values untouched', () => {
    expect(formatExplanationSignalValue('0%', true)).toBe('0%')
    expect(formatExplanationSignalValue('3 sesiones', true)).toBe('3 sesiones')
    expect(formatExplanationSignalValue('—', false)).toBe('—')
  })
})
