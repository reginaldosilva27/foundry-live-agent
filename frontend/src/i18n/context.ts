/** The language the UI is rendering in. Defaults to English so a component renders bare. */
import { createContext, useCallback, useContext } from 'react'
import { t, type Lang, type StringKey } from './strings'

export const LangContext = createContext<Lang>('en')

export function useLang(): Lang {
  return useContext(LangContext)
}

/** `const s = useT()` then `s('composer.send')`. Keys are checked at compile time. */
export function useT(): (key: StringKey) => string {
  const lang = useLang()
  return useCallback((key: StringKey) => t(key, lang), [lang])
}
