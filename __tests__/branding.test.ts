import { IMPULSO_BRAND } from '@/lib/impulso-brand'

describe('impulso branding contract', () => {
  it('stays aligned with premium branding', () => {
    expect(IMPULSO_BRAND.name).toBe('Anclora Impulso')
    expect(IMPULSO_BRAND.logoPath).toBe('/anclora-impulso.png')
    expect(IMPULSO_BRAND.faviconPath).toBe('/favicon.ico')
    expect(IMPULSO_BRAND.premiumAccent).toBe('#FF6A00')
    expect(IMPULSO_BRAND.premiumCopper).toBe('#C07860')
    expect(IMPULSO_BRAND.premiumInterior).toBe('#1A1C2B')
    expect(IMPULSO_BRAND.premiumTypography).toBe('DM Sans')
  })
})
