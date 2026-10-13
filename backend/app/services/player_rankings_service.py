from app.cache import player_rankings_cache
from app.core.constants import LEAGUES
from app.services.espn_client import get_matchup_roster_details
from app.services.standings_service import get_current_week, get_player_owners


def get_player_rankings() -> list[dict]:
    """Season-long fantasy points per real player, deduped across leagues and weeks.

    The same real NFL player is often independently rostered in more than one of the
    three divisions. Since all divisions share the same scoring settings, a player's
    points for a given week are the same regardless of which league's roster you read
    them from — so summing across every (league, week) a player appears in would
    inflate anyone rostered in multiple leagues. Instead this keeps one points value
    per (player, week) and sums those, giving each player's true season total once.
    """
    if "rankings" in player_rankings_cache:
        return player_rankings_cache["rankings"]

    current_week = get_current_week()
    players: dict[str, dict] = {}

    for league_id in LEAGUES.values():
        for week in range(1, current_week + 1):
            for matchup in get_matchup_roster_details(league_id, week):
                for side in ("home_team", "away_team"):
                    for player in matchup[side]["roster"]:
                        player_id = player.get("player_id")
                        if not player_id:
                            continue
                        entry = players.setdefault(
                            player_id,
                            {
                                "player_id": player_id,
                                "name": player["name"],
                                "position": player["position"],
                                "nfl_team": player["nfl_team"],
                                "league_id": league_id,
                                "weeks": {},
                            },
                        )
                        entry["weeks"][week] = player["points"]

    rankings = []
    for entry in players.values():
        weeks = entry["weeks"]
        games_played = len(weeks)
        total_points = round(sum(weeks.values()), 1)
        # Live current-roster lookup, not a reconstruction from past weeks' boxscores —
        # a player dropped since their last rostered week must show as unowned, not stuck
        # showing whichever team last had them.
        owners = get_player_owners(int(entry["player_id"]))
        rankings.append(
            {
                "player_id": entry["player_id"],
                "name": entry["name"],
                "position": entry["position"],
                "nfl_team": entry["nfl_team"],
                "league_id": entry["league_id"],
                "owners": owners,
                "total_points": total_points,
                "games_played": games_played,
                "avg_points": round(total_points / games_played, 1) if games_played else 0.0,
            }
        )

    rankings.sort(key=lambda r: r["total_points"], reverse=True)
    player_rankings_cache["rankings"] = rankings
    return rankings


def get_player_weekly_performance(league_id: str, player_id: str) -> list[dict]:
    """This player's points and scoring breakdown for every week played so far this
    season, scanned week-by-week from that league's boxscores.

    The roster-overview endpoint (fetch_league_data) only embeds a narrow window of a
    player's actual weekly stats — current week plus projections plus the season total —
    not full season history, so it can't answer "every week that's happened" on its own.
    """
    current_week = get_current_week()
    performance = []

    for week in range(1, current_week + 1):
        for matchup in get_matchup_roster_details(league_id, week):
            for side in ("home_team", "away_team"):
                for player in matchup[side]["roster"]:
                    if player.get("player_id") == player_id:
                        performance.append(
                            {
                                "week": week,
                                "points": player["points"],
                                "scoring_breakdown": player["scoring_breakdown"],
                            }
                        )

    performance.sort(key=lambda w: w["week"])
    return performance
