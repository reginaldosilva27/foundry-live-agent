import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BuildInfo } from './BuildInfo'
import { LangContext } from '../i18n/context'
import { t, type Lang } from '../i18n/strings'

const demo = {
  recordedAt: '2026-09-15', current: 'round-trip',
  recordings: [{ id: 'round-trip', recorded_at: '2026-09-15' }, { id: 'unknown', recorded_at: '2026-09-15' }],
  choose: vi.fn(),
}

function show(lang: Lang = 'en', failed = false) {
  return render(<LangContext.Provider value={lang}><BuildInfo config={null} configFailed={failed} demo={demo} /></LangContext.Provider>)
}

describe('compact build information', () => {
  it.each(['en', 'pt'] as const)('keeps Replay visible and discloses exact facts by keyboard in %s', async (lang) => {
    show(lang)
    const user = userEvent.setup()
    const opener = screen.getByRole('button', { name: t('buildInfo.title', lang) })
    expect(screen.getByTestId('replay-badge')).toHaveTextContent(t('demo.title', lang))
    expect(screen.queryByTestId('demo-banner')).toBeNull()
    expect(screen.queryByText(t('demo.body', lang).replace('{date}', demo.recordedAt))).toBeNull()
    expect(screen.queryByText(t('sidebar.transport', lang))).toBeNull()
    opener.focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: t('buildInfo.title', lang) })
    expect(dialog).toHaveTextContent(t('demo.body', lang).replace('{date}', demo.recordedAt))
    expect(dialog).toHaveTextContent(t('config.loading', lang))
    expect(dialog).toHaveTextContent(t('sidebar.transport', lang))
    const picker = screen.getByRole('combobox', { name: t('demo.pick', lang) })
    await user.selectOptions(picker, 'unknown')
    expect(demo.choose).toHaveBeenCalledWith('unknown')
    await user.tab()
    expect(screen.getByRole('button', { name: t('buildInfo.close', lang) })).toHaveFocus()
    await user.tab({ shift: true })
    expect(picker).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(opener).toHaveFocus()
    expect(screen.getByTestId('replay-badge')).toBeVisible()
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: t('buildInfo.close', lang) }))
    expect(opener).toHaveFocus()
  })

  it('distinguishes unavailable config and has no replay label on a live build', async () => {
    render(<LangContext.Provider value="en"><BuildInfo config={null} configFailed demo={null} /></LangContext.Provider>)
    expect(screen.queryByTestId('replay-badge')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: t('buildInfo.title', 'en') }))
    expect(screen.getByRole('dialog')).toHaveTextContent(t('config.unavailable', 'en'))
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
