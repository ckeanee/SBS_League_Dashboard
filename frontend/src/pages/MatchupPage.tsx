import { ArrowLeft, ChevronDown, ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useBoxscore, usePlayoffMatchup } from '../api/queries'
import type { BoxscorePlayer, BoxscoreTeam } from '../api/types'
import { MatchupCard } from '../components/MatchupCard'
import { PlayoffBoxscores } from '../components/PlayoffBoxscores'
import { PlayStatusBadge } from '../components/PlayStatusBadge'
import { Card, Section } from '../components/ui/Section'
import { EmptyState, LoadingState } from '../components/ui/States'
import { MATCHUP_TYPE_COLORS } from '../lib/constants'
import { formatGameTime, headshotUrl, pointsColor, recordSubtitle } from '../lib/format'

/** Full detail for one game — reached by clicking a score anywhere in the app (Home,
 * Scoreboard, Teams). Two shapes share this page: a regular-season game (same-league,
 * identified by league/week/team) and a playoff game (cross-league, identified by its
 * stored matchup id). */
export function MatchupPage() {
  const { matchupId } = useParams()
  return matchupId ? <PlayoffMatchupDetail matchupId={Number(matchupId)} /> : <RegularMatchupDetail />
}

function BackLink() {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  )
}

function RegularMatchupDetail() {
  const { leagueId, week, teamId } = useParams()
  const weekNum = Number(week)
  const teamIdNum = Number(teamId)
  const { data: boxscores, isLoading } = useBoxscore(leagueId, weekNum)
  const matchup = boxscores?.find((m) => m.home.team.team_id === teamIdNum || m.away.team.team_id === teamIdNum)

  if (isLoading) return <LoadingState label="Loading matchup…" />
  if (!matchup) return <EmptyState label="Matchup not found" />

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <BackLink />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Week {weekNum} Matchup</h1>
          <p className="text-sm text-ink-500 mt-1">{matchup.home.team.league_name}</p>
        </div>
        <PlayStatusBadge status={matchup.status} />
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-line">
          <TeamHeader team={matchup.home} align="left" />
          <TeamHeader team={matchup.away} align="right" />
        </div>
        <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-4 border-t border-line">
          <TeamOutlook team={matchup.home} align="left" />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className="text-2xl sm:text-3xl font-display font-bold tabular-nums text-ink-100">
              {matchup.home.total_points.toFixed(1)}
            </span>
            <span className="text-ink-600">·</span>
            <span className="text-2xl sm:text-3xl font-display font-bold tabular-nums text-ink-100">
              {matchup.away.total_points.toFixed(1)}
            </span>
          </div>
          <TeamOutlook team={matchup.away} align="right" />
        </div>
      </Card>

      <Section title="Scoring Breakdown" icon={ClipboardList}>
        <Card className="overflow-hidden">
          <MatchupPlayerTable home={matchup.home.roster} away={matchup.away.roster} />
        </Card>
      </Section>
    </div>
  )
}

function TeamHeader({ team, align }: { team: BoxscoreTeam; align: 'left' | 'right' }) {
  const isRight = align === 'right'
  return (
    <div className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-5 ${isRight ? 'flex-row-reverse text-right' : ''}`}>
      {team.logo ? (
        <img
          src={team.logo}
          alt=""
          className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
        />
      ) : (
        <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl bg-white/5 shrink-0" />
      )}
      <div className="min-w-0">
        <Link
          to={`/teams/${team.team.league_id}/${team.team.team_id}`}
          className="font-display text-sm sm:text-xl font-bold text-ink-100 hover:text-brand-400 truncate block"
        >
          {team.overall_rank ? (
            <span className="text-xs sm:text-sm font-normal text-ink-500 mr-1">{team.overall_rank}</span>
          ) : null}
          {team.team.team_name}
        </Link>
        <div className="text-xs sm:text-sm text-ink-400 truncate">{team.team.owner}</div>
        <div className="text-[11px] sm:text-xs text-ink-500 truncate">
          {recordSubtitle(team.wins, team.losses, team.league_rank, team.team.league_name)}
        </div>
      </div>
    </div>
  )
}

function TeamOutlook({ team, align }: { team: BoxscoreTeam; align: 'left' | 'right' }) {
  const isRight = align === 'right'
  return (
    <div
      className={`flex-1 flex flex-col sm:flex-row gap-0.5 sm:gap-3 text-[11px] sm:text-xs text-ink-500 ${
        isRight ? 'items-end sm:justify-end' : 'items-start'
      }`}
    >
      <span className="whitespace-nowrap">
        In Play: <span className="font-semibold text-ink-200">{team.in_play}</span>
      </span>
      <span className="whitespace-nowrap">
        To Play: <span className="font-semibold text-ink-200">{team.to_play}</span>
      </span>
      <span className="whitespace-nowrap">
        Proj Total: <span className="font-semibold text-ink-200">{team.proj_total.toFixed(1)}</span>
      </span>
    </div>
  )
}

/** Side-by-side box score, paired row by row across matching position slots (both
 * teams carry the same QB/K/K/K/P/P/P composition in this league), with the shared
 * position label running down the middle — mirrors ESPN's own matchup layout. */
function MatchupPlayerTable({ home, away }: { home: BoxscorePlayer[]; away: BoxscorePlayer[] }) {
  const rowCount = Math.max(home.length, away.length)
  const rows = Array.from({ length: rowCount }, (_, i) => ({ home: home[i], away: away[i] }))

  return (
    <div className="divide-y divide-line/60">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_28px_1fr] sm:grid-cols-[1fr_52px_1fr] items-stretch">
          <PlayerCell player={row.home} align="left" />
          <div className="flex items-center justify-center text-[10px] sm:text-[11px] font-semibold text-ink-500 bg-white/[0.02]">
            {row.home?.position ?? row.away?.position ?? ''}
          </div>
          <PlayerCell player={row.away} align="right" />
        </div>
      ))}
    </div>
  )
}

function PlayerGameInfo({ player }: { player: BoxscorePlayer }) {
  const { game_status, nfl_opponent, nfl_team_score, nfl_opponent_score, nfl_game_date, nfl_is_home } = player

  if (!game_status || !nfl_opponent) {
    return <span className="text-ink-600">Bye</span>
  }

  const vsAt = nfl_is_home ? '' : '@'
  const hasScore = nfl_team_score !== null && nfl_opponent_score !== null

  if (game_status === 'pending') {
    return (
      <span>
        {vsAt}
        {nfl_opponent} · {formatGameTime(nfl_game_date)}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <PlayStatusBadge status={game_status} compact />
      {hasScore ? `${nfl_team_score}-${nfl_opponent_score}` : ''} {vsAt}
      {nfl_opponent}
    </span>
  )
}

function PlayerCell({ player, align }: { player: BoxscorePlayer | undefined; align: 'left' | 'right' }) {
  const [expanded, setExpanded] = useState(false)
  if (!player) return <div className="py-2.5 px-3" />

  const isRight = align === 'right'
  const hasPlayed = player.game_status === 'live' || player.game_status === 'finished'
  const pointsDisplay = hasPlayed ? player.points.toFixed(1) : '--'
  const hasStatLine = hasPlayed && player.scoring_breakdown.length > 0

  return (
    <div
      onClick={hasStatLine ? () => setExpanded((v) => !v) : undefined}
      className={hasStatLine ? 'cursor-pointer hover:bg-white/[0.03]' : ''}
    >
      <div className={`flex items-center gap-1.5 sm:gap-2.5 py-2 sm:py-2.5 px-1.5 sm:px-3 ${isRight ? 'flex-row-reverse' : ''}`}>
        {player.player_id ? (
          <img
            src={headshotUrl(player.player_id)}
            alt=""
            className="w-7 h-[22px] sm:w-9 sm:h-7 rounded object-cover bg-white/5 shrink-0"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="w-7 h-[22px] sm:w-9 sm:h-7 rounded bg-white/5 shrink-0" />
        )}
        <div className={`min-w-0 flex-1 ${isRight ? 'text-right' : ''}`}>
          <div className={`flex items-center gap-1 min-w-0 ${isRight ? 'flex-row-reverse' : ''}`}>
            <span className="text-[13px] sm:text-sm font-medium text-ink-100 truncate">{player.name}</span>
            {hasStatLine ? (
              <ChevronDown
                className={`w-3 h-3 text-ink-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            ) : null}
          </div>
          <div className="text-[10px] sm:text-[11px] text-ink-500 truncate">
            {player.nfl_team} {player.position}
          </div>
          <div className="text-[10px] sm:text-[11px] text-ink-500 truncate">
            <PlayerGameInfo player={player} />
          </div>
        </div>
        <div className={`text-[13px] sm:text-sm font-bold tabular-nums shrink-0 ${hasPlayed ? pointsColor(player.points) : 'text-ink-500'}`}>
          {pointsDisplay}
        </div>
      </div>
      {hasStatLine && expanded ? (
        <div
          className={`flex flex-wrap gap-x-2 gap-y-1 px-1.5 sm:px-3 pb-2 ${isRight ? 'justify-end text-right' : ''}`}
        >
          {player.scoring_breakdown.map((s, i) => (
            <span key={i} className="text-[10px] sm:text-[11px] text-ink-500 whitespace-nowrap">
              <span className="text-ink-300 font-medium">{s.value}</span> {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PlayoffMatchupDetail({ matchupId }: { matchupId: number }) {
  const { data: matchup, isLoading } = usePlayoffMatchup(matchupId)

  if (isLoading) return <LoadingState label="Loading matchup…" />
  if (!matchup) return <EmptyState label="Matchup not found" />

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <BackLink />
      <div>
        <h1 className="font-display text-2xl font-bold">
          Week {matchup.week} · {matchup.round_type}
        </h1>
      </div>

      <MatchupCard
        badge={{ label: matchup.round_type, color: MATCHUP_TYPE_COLORS[matchup.round_type] ?? '#a78bfa' }}
        home={{
          name: matchup.home.team.team_name,
          owner: matchup.home.team.owner,
          logo: matchup.home.logo,
          score: matchup.home.score,
          winning: matchup.home.winning,
          subtitle: `(${matchup.home.team.league_name}, ${matchup.home.wins}-${matchup.home.losses}, seed ${matchup.home.seed})`,
          leagueId: matchup.home.team.league_id,
          teamId: matchup.home.team.team_id,
        }}
        away={{
          name: matchup.away.team.team_name,
          owner: matchup.away.team.owner,
          logo: matchup.away.logo,
          score: matchup.away.score,
          winning: matchup.away.winning,
          subtitle: `(${matchup.away.team.league_name}, ${matchup.away.wins}-${matchup.away.losses}, seed ${matchup.away.seed})`,
          leagueId: matchup.away.team.league_id,
          teamId: matchup.away.team.team_id,
        }}
      />

      <Section title="Scoring Breakdown" icon={ClipboardList}>
        <PlayoffBoxscores
          homeLeagueId={matchup.home.team.league_id}
          awayLeagueId={matchup.away.team.league_id}
          homeTeamId={matchup.home.team.team_id}
          awayTeamId={matchup.away.team.team_id}
          homeName={matchup.home.team.team_name}
          awayName={matchup.away.team.team_name}
          week={matchup.week}
        />
      </Section>
    </div>
  )
}
