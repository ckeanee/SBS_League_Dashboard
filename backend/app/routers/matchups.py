from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.constants import LEAGUE_ID_TO_NAME
from app.db.session import get_db
from app.schemas.matchups import BoxscoreMatchup, RegularMatchup
from app.schemas.playoff_matchups import PlayoffMatchupRead
from app.services import matchup_service, standings_service
from app.services.espn_client import fetch_league_data, get_matchup_roster_details, parse_current_roster
from app.services.nfl_schedule_service import (
    combine_play_status,
    get_nfl_game_info,
    team_play_status,
    team_week_outlook,
)
from app.services.playoff_service import calculate_playoff_standings
from app.services.standings_service import fetch_all_matchups

router = APIRouter(tags=["matchups"])


@router.get("/matchups/playoffs/{matchup_id}", response_model=PlayoffMatchupRead)
def playoff_matchup_detail(matchup_id: int, db: Session = Depends(get_db)):
    """Single playoff matchup with live score/seed/record — the read side of playoff
    matchups is public (only create/update/delete are admin-gated), so this lives here
    rather than under the admin-only playoff_matchups router."""
    matchup = matchup_service.get_matchup(db, matchup_id)
    return matchup_service.enrich_matchup(matchup)


@router.get("/matchups", response_model=list[RegularMatchup])
def matchups(week: int | None = Query(default=None)):
    """Regular-season matchups. Omit `week` to get every week (used for the home page's
    weekly-high-scores section and week selector), or pass it to filter to one week."""
    return fetch_all_matchups(week)


@router.get("/matchups/{league_id}/{week}/boxscore", response_model=list[BoxscoreMatchup])
def boxscore(league_id: str, week: int):
    league_name = LEAGUE_ID_TO_NAME.get(league_id, "")
    raw_matchups = get_matchup_roster_details(league_id, week)

    all_standings = standings_service.fetch_all_leagues()
    playoff_rows = calculate_playoff_standings(all_standings, fetch_all_matchups())
    standings_by_team_id = {row["team"]["team_id"]: row for row in all_standings if row["team"]["league_id"] == league_id}
    # The number shown next to a team elsewhere in the app (e.g. the Home standings
    # table) is playoff seed, not plain win/points rank — those two can diverge once a
    # league's guaranteed-spot rule kicks in, so this has to match seed or it reads as
    # a bug (a team can be "seed 8" on Home but "rank 11" here otherwise).
    seed_by_team_id = {row["team"]["team_id"]: row["rank"] for row in playoff_rows if row["team"]["league_id"] == league_id}

    def _team_standing(team_id: int) -> dict:
        row = standings_by_team_id.get(team_id)
        if not row:
            return {"league_rank": None, "overall_rank": None, "wins": None, "losses": None}
        return {
            "league_rank": row["league_rank"],
            "overall_rank": seed_by_team_id.get(team_id),
            "wins": row["wins"],
            "losses": row["losses"],
        }

    game_info = get_nfl_game_info(week)
    league_data = fetch_league_data(league_id)
    teams_by_id = {t.get("id"): t for t in (league_data or {}).get("teams", [])}

    def _roster_for(team_id: int, locked_roster: list[dict]) -> list[dict]:
        # A week's boxscore roster is empty until that week locks — before then, fall
        # back to the team's always-current roster so the matchup page still shows who's
        # playing (with points 0, since nothing's happened yet).
        if locked_roster:
            return locked_roster
        team = teams_by_id.get(team_id)
        return parse_current_roster(team) if team else []

    def _enrich_roster(roster: list[dict]) -> list[dict]:
        enriched = []
        for player in roster:
            game = game_info.get(player.get("nfl_team"))
            enriched.append(
                {
                    **player,
                    "game_status": game["status"] if game else None,
                    "nfl_opponent": game["opponent"] if game else None,
                    "nfl_team_score": game["score"] if game else None,
                    "nfl_opponent_score": game["opponent_score"] if game else None,
                    "nfl_game_date": game["date"] if game else None,
                    "nfl_is_home": game["is_home"] if game else None,
                }
            )
        return enriched

    result = []
    for m in raw_matchups:
        home, away = m["home_team"], m["away_team"]
        home_roster = _roster_for(home["id"], home["roster"])
        away_roster = _roster_for(away["id"], away["roster"])
        home_status = team_play_status(home_roster, game_info)
        away_status = team_play_status(away_roster, game_info)
        result.append(
            {
                "week": m["week"],
                "status": combine_play_status(home_status, away_status),
                "home": {
                    "team": standings_service.team_ref(league_id, league_name, home["id"], home["name"]),
                    "logo": home["logo"],
                    "total_points": home["total_points"],
                    "roster": _enrich_roster(home_roster),
                    "status": home_status,
                    **team_week_outlook(league_data, home["id"], week, game_info, home_roster, home["total_points"]),
                    **_team_standing(home["id"]),
                },
                "away": {
                    "team": standings_service.team_ref(league_id, league_name, away["id"], away["name"]),
                    "logo": away["logo"],
                    "total_points": away["total_points"],
                    "roster": _enrich_roster(away_roster),
                    "status": away_status,
                    **team_week_outlook(league_data, away["id"], week, game_info, away_roster, away["total_points"]),
                    **_team_standing(away["id"]),
                },
            }
        )
    return result
