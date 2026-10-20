import type { PlayStatus } from '../api/types'

/** Whether a matchup's rostered players have yet to play, are playing right now, or are
 * all done — the main signal being "do I still have someone going" on a Sunday/Monday.
 * `compact` drops the pill chrome for tight contexts like an inline player row. */
export function PlayStatusBadge({ status, compact = false }: { status: PlayStatus; compact?: boolean }) {
  if (status === 'live') {
    return (
      <span
        className={
          compact
            ? 'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-bad'
            : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-bad/15 text-bad ring-1 ring-bad/40'
        }
      >
        <span className="relative flex w-1.5 h-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bad opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bad" />
        </span>
        Live
      </span>
    )
  }

  if (status === 'finished') {
    return (
      <span
        className={
          compact
            ? 'text-[10px] font-bold uppercase tracking-wide text-ink-500'
            : 'inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide bg-white/5 text-ink-400 ring-1 ring-white/10'
        }
      >
        Final
      </span>
    )
  }

  return (
    <span
      className={
        compact
          ? 'text-[10px] font-semibold uppercase tracking-wide text-ink-600'
          : 'inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide text-ink-500'
      }
    >
      Upcoming
    </span>
  )
}
