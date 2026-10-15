// Regenerates docs/assets/message-journey-{en,pt}.gif from journey.html beside this file.
//
// Needs ffmpeg on PATH and Playwright, which this repository does not depend on:
//
//   npm i --no-save --prefix /tmp/pw playwright@1.57.0
//   PLAYWRIGHT_MODULE=/tmp/pw/node_modules/playwright/index.mjs \
//     node docs/assets/message-journey/record.mjs
//
// One screenshot per step, each held for HOLD_SECONDS, then a two-pass palette so the GIF stays
// sharp and small. Fonts load from Google Fonts, so the run needs network access.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')

const HOLD_SECONDS = 5
const here = dirname(fileURLToPath(import.meta.url))
const page_url = pathToFileURL(join(here, 'journey.html')).href
const assets = resolve(here, '..')

const browser = await chromium.launch()
try {
  for (const lang of ['en', 'pt']) {
    const frames = mkdtempSync(join(tmpdir(), `journey-${lang}-`))
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 })
    await page.goto(`${page_url}?lang=${lang}`)
    await page.evaluate(() => document.fonts.ready)
    const count = await page.evaluate(() => window.journey.count)
    // Every frame must be the same size or ffmpeg's concat drops frames: pin the tallest step.
    await page.evaluate((n) => {
      const capture = document.getElementById('capture')
      let tallest = 0
      for (let k = 0; k < n; k++) {
        window.journey.go(k)
        tallest = Math.max(tallest, capture.getBoundingClientRect().height)
      }
      capture.style.minHeight = `${Math.ceil(tallest)}px`
    }, count)
    const list = []
    for (let step = 0; step < count; step++) {
      await page.evaluate((k) => window.journey.go(k), step)
      const file = join(frames, `${String(step).padStart(2, '0')}.png`)
      await page.locator('#capture').screenshot({ path: file })
      list.push(`file '${file}'`, `duration ${HOLD_SECONDS}`)
    }
    // The concat demuxer ignores the last duration unless the last file is repeated.
    list.push(list.at(-2))
    const concat = join(frames, 'frames.txt')
    writeFileSync(concat, list.join('\n'))
    const out = join(assets, `message-journey-${lang}.gif`)
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', concat,
      '-vf', `fps=1/${HOLD_SECONDS},scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      out,
    ])
    console.log(`wrote ${out}`)
    await page.close()
  }
} finally {
  await browser.close()
}
