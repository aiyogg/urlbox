import { Hono } from 'hono'
import puppeteer from '@cloudflare/puppeteer'
import type { BrowserWorker } from '@cloudflare/puppeteer'

type Bindings = {
  MYBROWSER: BrowserWorker
  BROWSER_KV_URLBOX: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  let url = c.req.query('url')
  let img: Buffer | null
  if (url) {
    url = new URL(url).toString()
    img = (await c.env.BROWSER_KV_URLBOX.get(url, {
      type: 'arrayBuffer',
    })) as Buffer
    if (img === null) {
      const browser = await puppeteer.launch(c.env.MYBROWSER)
      const page = await browser.newPage()
      await page.goto(url)
      img = (await page.screenshot()) as Buffer
      await c.env.BROWSER_KV_URLBOX.put(url, img, {
        expirationTtl: 60 * 60 * 24,
      })
      await browser.close()
    }
    c.header('Content-Type', 'image/jpeg')
    c.status(200)
    return c.body(img)
  } else {
    c.status(400)
    return c.json({ error: 'url is required' })
  }
})

export default app
