/**
 * The icon set. SVG only.
 *
 * The Dataside brand forbids emoji and Unicode glyph icons as decoration: no check mark, chevron or
 * bullet is ever a character in this app, and a test enforces that. Each icon inherits `currentColor`
 * and takes its box from the `size` prop.
 */

interface IconProps {
  size?: number
  className?: string
}

function svg(children: React.ReactNode, { size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const CheckIcon = (p: IconProps) => svg(<polyline points="4 12.5 9.5 18 20 6.5" />, p)

export const AlertIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12" y2="16.5" />
    </>,
    p,
  )

export const SpinnerIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" />
    </>,
    { ...p, className: ['icon-spin', p.className].filter(Boolean).join(' ') },
  )

export const ChevronIcon = (p: IconProps) => svg(<polyline points="9 5 16 12 9 19" />, p)

export const SendIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="21" y1="3" x2="10.5" y2="13.5" />
      <polygon points="21 3 14.5 21 10.5 13.5 3 9.5 21 3" />
    </>,
    p,
  )

export const MicIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5 11.5a7 7 0 0 0 14 0" />
      <line x1="12" y1="18.5" x2="12" y2="21.5" />
    </>,
    p,
  )

export const CloseIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
      <line x1="18.5" y1="5.5" x2="5.5" y2="18.5" />
    </>,
    p,
  )

export const ExternalIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M14 4h6v6" />
      <line x1="20" y1="4" x2="11" y2="13" />
      <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
    </>,
    p,
  )

export const SpeakerIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>,
    p,
  )

export const ActivityIcon = (p: IconProps) =>
  svg(<polyline points="2.5 12 7 12 10 4.5 14 19.5 17 12 21.5 12" />, p)
