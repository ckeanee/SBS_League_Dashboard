import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import type { PlayStatus, StatLineItem } from '../api/types'
import { headshotUrl, pointsColor } from '../lib/format'
import { PlayStatusBadge } from './PlayStatusBadge'

interface PlayerGameInfo {
  status: PlayStatus | null
  opponent: string | null
  teamScore: number | null
  opponentScore: number | null
}

interface PlayerRowProps {
  playerId: string
  name: string
  subtitle?: string
  trailing?: string
  points?: number
  /** Real per-game stat line explaining the score, e.g. "2-3 FG · 47 LONG · 3-3 XP".
   * Collapsed by default — click the row to reveal it. */
  statLine?: StatLineItem[]
  /** This player's own real NFL game this week — separate from the fantasy matchup. */
  gameInfo?: PlayerGameInfo
}

function GameInfoLine({ gameInfo }: { gameInfo: PlayerGameInfo }) {
  const { status, opponent, teamScore, opponentScore } = gameInfo

  if (!status || !opponent) {
    return <span className="text-[11px] text-ink-600">Bye</span>
  }

  const hasScore = teamScore !== null && opponentScore !== null

  return (
    <span className="inline-flex items-center gap-1.5">
      <PlayStatusBadge status={status} compact />
      <span className="text-[11px] text-ink-500">
        {status === 'pending' ? `vs ${opponent}` : `${hasScore ? `${teamScore}-${opponentScore}` : ''} vs ${opponent}`}
      </span>
    </span>
  )
}

export function PlayerRow({ playerId, name, subtitle, trailing, points, statLine, gameInfo }: PlayerRowProps) {
  const [expanded, setExpanded] = useState(false)
  const hasStatLine = Boolean(statLine && statLine.length > 0)

  return (
    <div className="rounded-lg hover:bg-white/[0.03] transition-colors">
      <div
        onClick={hasStatLine ? () => setExpanded((v) => !v) : undefined}
        className={`flex items-center justify-between gap-2 px-2.5 py-2 ${hasStatLine ? 'cursor-pointer' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {playerId ? (
            <img
              src={headshotUrl(playerId)}
              alt=""
              className="w-8 h-6 rounded object-cover shrink-0 bg-white/5"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <div className="w-8 h-6 rounded bg-white/5 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-sm font-medium text-ink-200 truncate">{name}</span>
              {hasStatLine ? (
                <ChevronDown
                  className={`w-3 h-3 text-ink-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                />
              ) : null}
            </div>
            {subtitle ? <div className="text-[11px] text-ink-500">{subtitle}</div> : null}
            {gameInfo ? (
              <div className="mt-0.5">
                <GameInfoLine gameInfo={gameInfo} />
              </div>
            ) : null}
          </div>
        </div>
        <div className={`text-sm font-bold tabular-nums shrink-0 ${points !== undefined ? pointsColor(points) : 'text-ink-400'}`}>
          {trailing}
        </div>
      </div>
      {hasStatLine && expanded ? (
        <div className="flex flex-wrap gap-x-2 gap-y-1 px-2.5 pb-2">
          {statLine!.map((s, i) => (
            <span key={i} className="text-[11px] text-ink-500 whitespace-nowrap">
              <span className="text-ink-300 font-medium">{s.value}</span> {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
