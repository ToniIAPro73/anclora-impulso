import { chromium } from '@playwright/test'
import { resolve } from 'node:path'

const auditDir = resolve(process.cwd(), 'docs/audits')
const htmlPath = resolve(auditDir, 'anclora-impulso-ux-reaudit-2026-09-14.html')
const pdfPath = resolve(auditDir, 'anclora-impulso-ux-reaudit-2026-09-14.pdf')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`file://${htmlPath}`, { waitUntil: 'load' })
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' },
  displayHeaderFooter: false,
})
await browser.close()
console.log(pdfPath)
