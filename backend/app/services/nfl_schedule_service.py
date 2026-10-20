import logging

import requests

from app.cache import nfl_schedule_cache

logger = logging.getLogger(__name__)

NFL_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"


def get_nfl_game_states(week: int) -> dict[str, str]:
    """NFL team abbreviation -> ESPN's own game state for this week: "pre" (not started),
    "in" (live), or "post" (final). A team on a bye is simply absent from the map.
    Non-fatal on failure — an empty map just means every matchup falls back to "pending"."""
    if week in nfl_schedule_cache:
        return nfl_schedule_cache[week]

    try:
        response = requests.get(NFL_SCOREBOARD_URL, params={"week": week, "seasontype": 2}, timeout=15)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        logger.warning("Could not fetch NFL scoreboard for week %s: %s", week, e)
        return {}

    states: dict[str, str] = {}
    for event in data.get("events", []):
        competition = (event.get("competitions") or [{}])[0]
        state = competition.get("status", {}).get("type", {}).get("state", "pre")
        for competitor in competition.get("competitors", []):
            abbr = competitor.get("team", {}).get("abbreviation")
            if abbr:
                states[abbr] = state

    nfl_schedule_cache[week] = states
    return states


def team_play_status(roster: list[dict], game_states: dict[str, str]) -> str:
    """A fantasy team's own pending/live/finished status, from its roster's real NFL
    teams' game states. Players on a bye (absent from game_states) don't count either
    way — a bye week doesn't keep a team "pending" forever."""
    relevant = [game_states[p["nfl_team"]] for p in roster if p.get("nfl_team") in game_states]
    if not relevant:
        return "pending"
    if any(state == "in" for state in relevant):
        return "live"
    if all(state == "post" for state in relevant):
        return "finished"
    return "pending"


def combine_play_status(a: str, b: str) -> str:
    """Combine two teams' statuses into one matchup-level status."""
    if "live" in (a, b):
        return "live"
    if a == "finished" and b == "finished":
        return "finished"
    return "pending"
