import { useNavigate } from 'react-router-dom'

import { useBoxscore } from '../api/queries'
import { recordSubtitle } from '../lib/format'
import { MatchupCard } from './MatchupCard'
import { LoadingState, EmptyState } from './ui/States'

interface RegularSeasonColumnProps {
  leagueName: string
  leagueId: string
  week: number | null
}

/** One league's regular-season matchups for a given week — click a card to see the full
 * box score on its own page. Used by the Scoreboard page. */
export function RegularSeasonColumn({ leagueName, leagueId, week }: RegularSeasonColumnProps) {
  const navigate = useNavigate()
  const { data: boxscores, isLoading } = useBoxscore(leagueId, week ?? undefined)

  return (
    <div>
      <h3 className="text-brand-400 font-semibold text-sm uppercase tracking-wide mb-3">{leagueName}</h3>
      {isLoading ? (
        <LoadingState />
      ) : !boxscores || boxscores.length === 0 ? (
        <EmptyState label={`No matchups for week ${week}`} />
      ) : (
        boxscores.map((m) => (
          <MatchupCard
            key={`${m.home.team.team_id}-${m.away.team.team_id}`}
            onOpenMatchup={() => navigate(`/matchup/${leagueId}/${week}/${m.home.team.team_id}`)}
            status={m.status}
            home={{
              name: m.home.team.team_name,
              owner: m.home.team.owner,
              logo: m.home.logo,
              score: m.home.total_points,
              winning: m.home.total_points > m.away.total_points,
              leagueId: m.home.team.league_id,
              teamId: m.home.team.team_id,
              rank: m.home.overall_rank,
              subtitle: recordSubtitle(m.home.wins, m.home.losses, m.home.league_rank, leagueName),
              status: m.home.status,
              projTotal: m.home.proj_total,
            }}
            away={{
              name: m.away.team.team_name,
              owner: m.away.team.owner,
              logo: m.away.logo,
              score: m.away.total_points,
              winning: m.away.total_points > m.home.total_points,
              leagueId: m.away.team.league_id,
              teamId: m.away.team.team_id,
              rank: m.away.overall_rank,
              subtitle: recordSubtitle(m.away.wins, m.away.losses, m.away.league_rank, leagueName),
              status: m.away.status,
              projTotal: m.away.proj_total,
            }}
          />
        ))
      )}
    </div>
  )
}
