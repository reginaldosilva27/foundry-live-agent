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


export const ActivityIcon = (p: IconProps) =>
  svg(<polyline points="2.5 12 7 12 10 4.5 14 19.5 17 12 21.5 12" />, p)

export const CopyIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5" />
    </>,
    p,
  )


// --- The shell's navigation and actions (spec 021) --------------------------

export const ChatIcon = (p: IconProps) =>
  svg(<path d="M20.5 12.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 3v-4.2A7.5 7.5 0 0 1 3 12.5 7.5 7.5 0 0 1 10.5 5h2.5a7.5 7.5 0 0 1 7.5 7.5Z" />, p)

export const AgentsIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 6.9" />
      <path d="M17.5 14.5a6.5 6.5 0 0 1 4 5.5" />
    </>,
    p,
  )

export const PanelIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="10" y1="4" x2="10" y2="20" />
    </>,
    p,
  )

export const SearchIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="20.5" y2="20.5" />
    </>,
    p,
  )

/** Inspect an agent (spec 030): look at what it is, without talking to it. */
export const InfoIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16.5" />
      <line x1="12" y1="7.6" x2="12" y2="7.7" />
    </>,
    p,
  )

/** The navigation, on a screen too narrow to keep the rail open (spec 047). */
export const MenuIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="3.5" y1="7" x2="20.5" y2="7" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" />
      <line x1="3.5" y1="17" x2="20.5" y2="17" />
    </>,
    p,
  )

/** Side by side (spec 020). Two panes of equal weight — the screen is the comparison. */
export const ColumnsIcon = (p: IconProps) =>
  svg(
    <>
      <rect x="3" y="4" width="8" height="16" rx="1.5" />
      <rect x="13" y="4" width="8" height="16" rx="1.5" />
    </>,
    p,
  )

/** The history screen and its nav item (spec 027). A record is a thing with a time on it. */
export const ClockIcon = (p: IconProps) =>
  svg(
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6.5 12 12 16 14" />
    </>,
    p,
  )

export const UploadIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="12" y1="20.5" x2="12" y2="9" />
      <polyline points="7.5 13.5 12 9 16.5 13.5" />
      <path d="M4 6.5V5A1.5 1.5 0 0 1 5.5 3.5h13A1.5 1.5 0 0 1 20 5v1.5" />
    </>,
    p,
  )

export const DownloadIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="12" y1="3.5" x2="12" y2="15" />
      <polyline points="7.5 10.5 12 15 16.5 10.5" />
      <path d="M4 17.5v1.5A1.5 1.5 0 0 0 5.5 20.5h13a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </>,
    p,
  )

export const TrashIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="4" y1="6.5" x2="20" y2="6.5" />
      <path d="M6.5 6.5 7.5 20a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13.5" />
      <path d="M9.5 6.5V4.6A1.1 1.1 0 0 1 10.6 3.5h2.8a1.1 1.1 0 0 1 1.1 1.1V6.5" />
    </>,
    p,
  )

export const PencilIcon = (p: IconProps) =>
  svg(
    <>
      <path d="M4 20h4L20 8a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z" />
      <line x1="15" y1="6" x2="18.5" y2="9.5" />
    </>,
    p,
  )

/** A filled square: the universal "this is running, end it" mark (spec 023). */
export const StopIcon = (p: IconProps) =>
  svg(<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none" />, p)

/** A loop back to the start: ask that again (spec 026). */
export const RepeatIcon = (p: IconProps) =>
  svg(
    <>
      <polyline points="4 11 4 7 16 7" />
      <polyline points="12 3 16 7 12 11" />
      <polyline points="20 13 20 17 8 17" />
      <polyline points="12 13 8 17 12 21" />
    </>,
    p,
  )

export const ChevronDownIcon = (p: IconProps) => svg(<polyline points="5 9 12 16 19 9" />, p)

export const PlusIcon = (p: IconProps) =>
  svg(
    <>
      <line x1="12" y1="4.5" x2="12" y2="19.5" />
      <line x1="4.5" y1="12" x2="19.5" y2="12" />
    </>,
    p,
  )

/**
 * The favourite mark (spec 022). One component, two states: the outline is the same polygon the
 * filled one is, so a starred card does not shift by a pixel.
 */
export const StarIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) =>
  svg(
    <polygon
      points="12 3.6 14.6 9.2 20.7 10 16.3 14.2 17.4 20.3 12 17.3 6.6 20.3 7.7 14.2 3.3 10 9.4 9.2"
      fill={filled ? 'currentColor' : 'none'}
    />,
    p,
  )
