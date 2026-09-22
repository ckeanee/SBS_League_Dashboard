import { useNavigate } from 'react-router-dom'

import { useBoxscore } from '../api/queries'
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
            home={{
              name: m.home.team.team_name,
              owner: m.home.team.owner,
              logo: m.home.logo,
              score: m.home.total_points,
              winning: m.home.total_points > m.away.total_points,
              leagueId: m.home.team.league_id,
              teamId: m.home.team.team_id,
            }}
            away={{
              name: m.away.team.team_name,
              owner: m.away.team.owner,
              logo: m.away.logo,
              score: m.away.total_points,
              winning: m.away.total_points > m.home.total_points,
              leagueId: m.away.team.league_id,
              teamId: m.away.team.team_id,
            }}
          />
        ))
      )}
    </div>
  )
}
