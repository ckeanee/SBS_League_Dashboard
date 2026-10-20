from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.constants import LEAGUE_ID_TO_NAME
from app.db.session import get_db
from app.schemas.matchups import BoxscoreMatchup, RegularMatchup
from app.schemas.playoff_matchups import PlayoffMatchupRead
from app.services import matchup_service, standings_service
from app.services.espn_client import get_matchup_roster_details
from app.services.nfl_schedule_service import combine_play_status, get_nfl_game_states, team_play_status
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

    standings_by_team_id = {
        row["team"]["team_id"]: row
        for row in standings_service.fetch_all_leagues()
        if row["team"]["league_id"] == league_id
    }

    def _team_standing(team_id: int) -> dict:
        row = standings_by_team_id.get(team_id)
        if not row:
            return {"league_rank": None, "overall_rank": None, "wins": None, "losses": None}
        return {"league_rank": row["league_rank"], "overall_rank": row["rank"], "wins": row["wins"], "losses": row["losses"]}

    game_states = get_nfl_game_states(week)

    result = []
    for m in raw_matchups:
        home, away = m["home_team"], m["away_team"]
        home_status = team_play_status(home["roster"], game_states)
        away_status = team_play_status(away["roster"], game_states)
        result.append(
            {
                "week": m["week"],
                "status": combine_play_status(home_status, away_status),
                "home": {
                    "team": standings_service.team_ref(league_id, league_name, home["id"], home["name"]),
                    "logo": home["logo"],
                    "total_points": home["total_points"],
                    "roster": home["roster"],
                    "status": home_status,
                    **_team_standing(home["id"]),
                },
                "away": {
                    "team": standings_service.team_ref(league_id, league_name, away["id"], away["name"]),
                    "logo": away["logo"],
                    "total_points": away["total_points"],
                    "roster": away["roster"],
                    "status": away_status,
                    **_team_standing(away["id"]),
                },
            }
        )
    return result
