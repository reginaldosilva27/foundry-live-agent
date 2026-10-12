import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LangContext } from '../i18n/context'
import { t } from '../i18n/strings'
import { emptyTurn } from '../state/turn'
import { Composer } from './Composer'
import { Conversation } from './Conversation'

for (const lang of ['en', 'pt'] as const) {
  describe(`chat identity (${lang})`, () => {
    for (const status of ['streaming', 'done', 'error'] as const) {
      it(`visibly names both roles while ${status}`, () => {
        const { container } = render(
          <LangContext.Provider value={lang}>
            <Conversation
              agent="chosen-agent"
              messages={[
                { role: 'user', id: 'q', text: 'A question' },
                { role: 'agent', id: 'a', startedAt: 0, turn: { ...emptyTurn(), status, text: 'An answer' } },
              ]}
              onSuggestion={() => {}}
              onOpenTrace={() => {}}
            />
          </LangContext.Provider>,
        )
        expect(container.querySelector('.bubble__label')).toHaveTextContent(t('turn.you', lang))
        expect(container.querySelector('.turn__identity')).toHaveTextContent('chosen-agent')
        expect(container.querySelector('.turn__identity')).not.toHaveAttribute('aria-hidden')
      })
    }

    it('uses the localized role when no agent name is supplied', () => {
      const { container } = render(
        <LangContext.Provider value={lang}>
          <Conversation messages={[{ role: 'agent', id: 'a', startedAt: 0, turn: emptyTurn() }]}
            onSuggestion={() => {}} onOpenTrace={() => {}} />
        </LangContext.Provider>,
      )
      expect(container.querySelector('.turn__identity')).toHaveTextContent(t('turn.agent', lang))
    })

    it('shows newline guidance without removing the accessible description', () => {
      render(
        <LangContext.Provider value={lang}>
          <Composer streaming={false} voiceEnabled={false} onSend={() => {}} onStop={() => {}} onVoice={() => {}} />
        </LangContext.Provider>,
      )
      const hint = screen.getByText(t('composer.newline', lang))
      expect(hint).not.toHaveClass('visually-hidden')
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-describedby', hint.id)
    })
  })
}
