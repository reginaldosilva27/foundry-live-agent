/**
 * Hand a generated file to the browser (spec 027).
 *
 * An object URL and a synthetic click, which is the only way a page saves a file it made itself.
 * The URL is revoked immediately after: it holds the blob alive until something lets go of it.
 *
 * It was a private function in `AnswerActions.tsx` until a conversation and the whole record needed
 * the same thing. Three callers is where single-use code stops being single-use (§4).
 */
export function saveFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export const MARKDOWN = 'text/markdown;charset=utf-8'
export const JSON_FILE = 'application/json;charset=utf-8'
