/** Spec 008 AC2, AC7 — cutting a streaming answer into sentences, and what the voice is given. */
import { describe, expect, it } from 'vitest'
import { flatten, nextSentences } from './speech'

describe('nextSentences', () => {
  it('yields a sentence only once it is finished', () => {
    const half = nextSentences('São 13:53 em São Paulo', 0)
    expect(half.sentences).toEqual([])
    expect(half.cursor).toBe(0)

    const whole = nextSentences('São 13:53 em São Paulo. E em Lisboa', 0)
    expect(whole.sentences).toEqual(['São 13:53 em São Paulo.'])
    expect(whole.cursor).toBe(23)
  })

  it('never returns the same sentence twice as the answer grows', () => {
    const first = nextSentences('Uma. Duas', 0)
    const second = nextSentences('Uma. Duas. Três', first.cursor)

    expect(first.sentences).toEqual(['Uma.'])
    expect(second.sentences).toEqual(['Duas.'])
  })

  it('cuts on question and exclamation marks and on line breaks too', () => {
    expect(nextSentences('Que horas são? Agora', 0).sentences).toEqual(['Que horas são?'])
    expect(nextSentences('Pronto!\nMais', 0).sentences).toEqual(['Pronto!'])
    expect(nextSentences('Um item\nOutro item\n', 0).sentences).toEqual(['Um item', 'Outro item'])
  })

  it('flushes the tail when the turn has settled, terminator or not', () => {
    expect(nextSentences('Sem ponto final', 0, { settled: true }).sentences).toEqual([
      'Sem ponto final',
    ])
    expect(nextSentences('   ', 0, { settled: true }).sentences).toEqual([])
  })
})

describe('flatten', () => {
  it('drops fenced code rather than reading it out', () => {
    expect(flatten('Assim:\n```python\nprint("oi")\n```\nPronto.')).toBe('Assim: Pronto.')
  })

  it('reads the words of a link, not its target', () => {
    expect(flatten('Veja a [documentação](https://example.com/docs) agora')).toBe(
      'Veja a documentação agora',
    )
  })

  it('strips emphasis, headings, list bullets and inline code markers', () => {
    expect(flatten('## Título')).toBe('Título')
    expect(flatten('É **muito** _claro_')).toBe('É muito claro')
    expect(flatten('- um\n- dois')).toBe('um dois')
    expect(flatten('use `get_current_datetime`')).toBe('use get_current_datetime')
  })
})
