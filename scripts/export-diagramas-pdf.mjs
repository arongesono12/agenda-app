import { pathToFileURL } from 'node:url'
import path from 'node:path'

const playwrightPath = 'C:\\Users\\AronEsono\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright\\index.js'
const { chromium } = await import(pathToFileURL(playwrightPath).href)

const root = process.cwd()
const htmlPath = path.join(root, 'docs', 'diagramas-aplicacion.html')
const pdfPath = path.join(root, 'docs', 'diagramas-aplicacion.pdf')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1404, height: 992 }, deviceScaleFactor: 1 })

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' })
await page.pdf({
  path: pdfPath,
  format: 'A4',
  landscape: true,
  printBackground: true,
  margin: {
    top: '0mm',
    right: '0mm',
    bottom: '0mm',
    left: '0mm',
  },
})

await browser.close()
console.log(pdfPath)
