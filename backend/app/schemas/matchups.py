from pydantic import BaseModel

from app.schemas.common import StatLineItem, TeamRef


class BoxscorePlayer(BaseModel):
    player_id: str
    name: str
    position: str
    nfl_team: str
    points: float
    # This game's scoring categories that actually contributed points (e.g. "FGA: 0.5",
    # "PTA44: -2.5") — the league's own scoring settings applied to this player's box
    # score, not a generic real-stat line. Empty when nothing contributed (bye, DNP).
    scoring_breakdown: list[StatLineItem] = []


class BoxscoreTeam(BaseModel):
    team: TeamRef
    logo: str
    total_points: float
    roster: list[BoxscorePlayer]


class BoxscoreMatchup(BaseModel):
    week: int
    home: BoxscoreTeam
    away: BoxscoreTeam


class RegularMatchup(BaseModel):
    league_name: str
    week: int
    home: TeamRef
    home_logo: str
    home_score: float
    away: TeamRef
    away_logo: str
    away_score: float
