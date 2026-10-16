import { expect, test } from '@playwright/test'

// What jsdom cannot see: a real browser, a real stream, a real layout. Three smokes against the
// replay, chosen because each one has already broken once while every unit test stayed green.

test('a replayed turn streams, calls its tools and settles', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Replay', { exact: true })).toBeVisible()

  const composer = page.getByRole('textbox', { name: 'Ask the agent something' })
  await composer.fill('How does this project stream tokens to the browser?')
  await composer.press('Enter')

  // The recorded round trip calls function tools and the Learn MCP server.
  await expect(page.locator('.tool-row').first()).toBeVisible({ timeout: 30_000 })
  // Settled: the turn reports its usage, which only arrives with `done`.
  await expect(page.getByText(/\d+ tokens/).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Idle', { exact: true })).toBeVisible()
  await expect(composer).toBeEnabled()
})

test('at 390px the rail is reachable and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  await page.getByRole('button', { name: 'Open the menu' }).click()
  await expect(page.getByRole('button', { name: 'Playground' })).toBeVisible()
})

test('the about screen renders the build it describes', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: 'What this build is' })).toBeVisible()
  // The event-mapping report is §10 in numeric form; it only renders from a live `GET /config`.
  await expect(page.getByRole('main')).toContainText(/\d+ of \d+ Foundry event names verified/)
})
