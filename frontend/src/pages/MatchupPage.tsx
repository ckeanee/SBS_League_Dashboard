import { ArrowLeft, ClipboardList } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { useBoxscore, usePlayoffMatchup } from '../api/queries'
import { BoxscoreRoster } from '../components/BoxscoreRoster'
import { MatchupCard } from '../components/MatchupCard'
import { PlayoffBoxscores } from '../components/PlayoffBoxscores'
import { Card, Section } from '../components/ui/Section'
import { EmptyState, LoadingState } from '../components/ui/States'
import { MATCHUP_TYPE_COLORS } from '../lib/constants'

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
    <div className="space-y-6 max-w-2xl mx-auto">
      <BackLink />
      <div>
        <h1 className="font-display text-2xl font-bold">Week {weekNum} Matchup</h1>
        <p className="text-sm text-ink-500 mt-1">{matchup.home.team.league_name}</p>
      </div>

      <MatchupCard
        home={{
          name: matchup.home.team.team_name,
          owner: matchup.home.team.owner,
          logo: matchup.home.logo,
          score: matchup.home.total_points,
          winning: matchup.home.total_points > matchup.away.total_points,
          leagueId: matchup.home.team.league_id,
          teamId: matchup.home.team.team_id,
        }}
        away={{
          name: matchup.away.team.team_name,
          owner: matchup.away.team.owner,
          logo: matchup.away.logo,
          score: matchup.away.total_points,
          winning: matchup.away.total_points > matchup.home.total_points,
          leagueId: matchup.away.team.league_id,
          teamId: matchup.away.team.team_id,
        }}
      />

      <Section title="Scoring Breakdown" icon={ClipboardList}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold text-ink-300 mb-2">{matchup.home.team.team_name}</p>
            <Card className="p-3">
              <BoxscoreRoster roster={matchup.home.roster} />
            </Card>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-300 mb-2">{matchup.away.team.team_name}</p>
            <Card className="p-3">
              <BoxscoreRoster roster={matchup.away.roster} />
            </Card>
          </div>
        </div>
      </Section>
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
