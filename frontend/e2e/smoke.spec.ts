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

// Spec 066: the flow is an SVG laid out from a grid, which jsdom never lays out at all. A replayed
// turn's flow must open, step, and fit a 320px screen without scrolling sideways.
test('a replayed turn draws its flow, steps through it, and fits a narrow screen', async ({ page }) => {
  await page.goto('/')
  const composer = page.getByRole('textbox', { name: 'Ask the agent something' })
  await composer.fill('How does this project stream tokens to the browser?')
  await composer.press('Enter')
  await expect(page.getByText(/\d+ tokens/).first()).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'View flow' }).first().click()
  const flow = page.getByTestId('turn-flow')
  await expect(flow).toBeVisible()
  await expect(page).toHaveURL(/\/trace\/[^/]+\/flow$/)
  const box = await page.getByTestId('flow-diagram').boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(300)
  expect(box?.height ?? 0).toBeGreaterThan(100)

  await flow.getByRole('button', { name: 'Next step' }).click()
  await expect(flow.getByTestId('flow-caption')).toContainText('the browser posts it to the BFF')

  await page.setViewportSize({ width: 320, height: 720 })
  await expect(flow).toHaveAttribute('data-orientation', 'vertical')
  // Polled: the resize reaches the layout a frame or two after the attribute changes.
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
    .toBeLessThanOrEqual(0)

  await flow.getByRole('button', { name: 'Close the flow' }).click()
  await expect(flow).toBeHidden()
})
