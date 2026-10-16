/**
 * An image in an answer (spec 044).
 *
 * Images already arrive today — an agent citing a Learn page cites pages with diagrams in them, and
 * `search_web` returns results with images — and until now they rendered as whatever the Markdown
 * renderer did with them: unsized, unlabelled, able to push the conversation column sideways.
 *
 * **No contract change** (§9). An image is a URL in `text_delta`, which is the whole argument
 * against spending a tenth event type on transporting one.
 *
 * **This is the one request in the app that does not go to the BFF.** "The browser talks to the BFF
 * and nothing else" is true of every request this app *makes*; an `<img>` to a documentation host
 * is not one of them. The alternative is worse — a proxy would make the BFF a machine that fetches
 * arbitrary URLs on request — so the mitigations are `referrerpolicy` and `loading`, and
 * `docs/architecture.md` says so rather than leaving a reader to find it.
 *
 * **It loads on request (spec 063).** The agent reads untrusted text — a web page, a document — and
 * a prompt injection there can make it write an image URL that carries the conversation in its
 * query string. An `<img>` would send that on render, with nobody pressing anything. So the image
 * first appears as its host and its description, and the browser fetches it only when the reader
 * asks for that one image.
 *
 * **No invented alt text.** An image the answer did not describe is presented as an image with no
 * description available, which is true and useful to a screen-reader user in a way a generated
 * guess is not (§5).
 */
import { useRef, useState } from 'react'
import { useModalFocus } from '../hooks/useModalFocus'
import { useT } from '../i18n/context'

export function AnswerImage({ src, alt }: { src?: string; alt?: string }) {
  const s = useT()
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  /**
   * **Base64 never arrives here, and that is measured rather than assumed.**
   *
   * `react-markdown` sanitises a `data:` source to the empty string before this component sees it,
   * so an inlined image renders nothing at all — a stronger guarantee than a size check of our own,
   * which would have been dead code pretending to do the work. It matters because an inlined image
   * would cross the SSE stream as a multi-megabyte string and then be written into this browser's
   * record, which keeps 25 conversations (spec 021).
   */
  if (!src) return null

  const described = (alt ?? '').trim()
  const host = hostOf(src)

  if (!loaded) {
    return (
      <span className="answer-image__pending" data-testid="answer-image-pending">
        <span className="answer-image__pending-text">
          <span>{described || s('image.noDescription')}</span>
          {host ? (
            <span className="answer-image__host">
              {s('image.from')} <code>{host}</code>
            </span>
          ) : (
            // Nothing a browser could fetch, so nothing to offer: the address, as text (AC6).
            <code className="answer-image__host">{src}</code>
          )}
        </span>
        {host && (
          <button type="button" className="answer-image__load" onClick={() => setLoaded(true)}>
            {s('image.load')}
          </button>
        )}
      </span>
    )
  }

  if (failed) {
    // Usually an expired link, which is exactly the thing worth being able to read and copy.
    return (
      <span className="answer-image__failed" role="note">
        {s('image.failed')} <code>{src}</code>
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        className="answer-image"
        data-testid="answer-image"
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt={described || s('image.noDescription')}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </button>
      {open && <Lightbox src={src} alt={described || s('image.noDescription')} onClose={() => setOpen(false)} />}
    </>
  )
}

/** The host an image would load from, or null for an address no browser could fetch. */
function hostOf(src: string): string | null {
  try {
    const url = new URL(src)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.host : null
  } catch {
    return null
  }
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const s = useT()
  const scrim = useRef<HTMLDivElement>(null)
  // The app's existing focus behaviour, not a second one (§4).
  useModalFocus(scrim)

  return (
    <div
      className="answer-image__scrim"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      ref={scrim}
      onClick={onClose}
    >
      <img src={src} alt={alt} referrerPolicy="no-referrer" />
      <button type="button" onClick={onClose}>
        {s('image.close')}
      </button>
    </div>
  )
}
