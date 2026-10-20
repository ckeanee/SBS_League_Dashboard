import logging

import requests

from app.cache import nfl_schedule_cache

logger = logging.getLogger(__name__)

NFL_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"

# ESPN's own game-state vocabulary -> ours, used everywhere else in the app
# ("pending"/"live"/"finished" — see BoxscorePlayer.game_status and friends).
_STATE_MAP = {"pre": "pending", "in": "live", "post": "finished"}


def get_nfl_game_info(week: int) -> dict[str, dict]:
    """NFL team abbreviation -> that team's game this week: status ("pending"/"live"/
    "finished"), opponent abbreviation, and both teams' live/final score. A team on a
    bye is simply absent from the map. Non-fatal on failure — an empty map just means
    every matchup falls back to "pending" with no per-player game context."""
    if week in nfl_schedule_cache:
        return nfl_schedule_cache[week]

    try:
        response = requests.get(NFL_SCOREBOARD_URL, params={"week": week, "seasontype": 2}, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        logger.warning("Could not fetch NFL scoreboard for week %s: %s", week, e)
        return {}

    info: dict[str, dict] = {}
    for event in data.get("events", []):
        competition = (event.get("competitions") or [{}])[0]
        raw_state = competition.get("status", {}).get("type", {}).get("state", "pre")
        status = _STATE_MAP.get(raw_state, "pending")
        competitors = competition.get("competitors", [])
        by_abbr = {
            c["team"]["abbreviation"]: c for c in competitors if c.get("team", {}).get("abbreviation")
        }
        for abbr, competitor in by_abbr.items():
            opponent_abbr = next((a for a in by_abbr if a != abbr), None)
            opponent = by_abbr.get(opponent_abbr) if opponent_abbr else None
            info[abbr] = {
                "status": status,
                "opponent": opponent_abbr,
                "score": competitor.get("score"),
                "opponent_score": opponent.get("score") if opponent else None,
                "date": event.get("date"),
                "is_home": competitor.get("homeAway") == "home",
            }

    nfl_schedule_cache[week] = info
    return info


def team_play_status(roster: list[dict], game_info: dict[str, dict]) -> str:
    """A fantasy team's own pending/live/finished status, from its roster's real NFL
    teams' game states. Players on a bye (absent from game_info) don't count either
    way — a bye week doesn't keep a team "pending" forever."""
    relevant = [game_info[p["nfl_team"]]["status"] for p in roster if p.get("nfl_team") in game_info]
    if not relevant:
        return "pending"
    if any(state == "live" for state in relevant):
        return "live"
    if all(state == "finished" for state in relevant):
        return "finished"
    return "pending"


def combine_play_status(a: str, b: str) -> str:
    """Combine two teams' statuses into one matchup-level status."""
    if "live" in (a, b):
        return "live"
    if a == "finished" and b == "finished":
        return "finished"
    return "pending"


def _status_and_counts(nfl_team: str | None, game_info: dict[str, dict]) -> str | None:
    return game_info.get(nfl_team, {}).get("status") if nfl_team else None


def team_week_outlook(
    league_data: dict, team_id: int, week: int, game_info: dict[str, dict], roster: list[dict], actual_total: float
) -> dict:
    """In-play / to-play counts for a team's roster this week, plus ESPN's own
    projected total for that matchup (`schedule[N].{home,away}.totalProjectedPoints`).
    That field goes stale (None) once a week is fully complete, since ESPN stops
    updating a projection for a game that's already final — in that case the team's
    actual total is the right number to show anyway, so it's used as the fallback.
    """
    in_play = 0
    to_play = 0
    for player in roster:
        status = _status_and_counts(player.get("nfl_team"), game_info)
        if status == "live":
            in_play += 1
        elif status in (None, "pending"):
            to_play += 1

    proj_total = None
    for matchup in (league_data or {}).get("schedule", []):
        if matchup.get("matchupPeriodId") != week:
            continue
        for participant in (matchup.get("home", {}), matchup.get("away", {})):
            if participant.get("teamId") == team_id:
                proj_total = participant.get("totalProjectedPoints")
                break

    if proj_total is None:
        proj_total = actual_total

    return {"in_play": in_play, "to_play": to_play, "proj_total": round(proj_total, 1)}
