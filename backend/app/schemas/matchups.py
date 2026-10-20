from typing import Literal

from pydantic import BaseModel

from app.schemas.common import StatLineItem, TeamRef

PlayStatus = Literal["pending", "live", "finished"]


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
    league_rank: int | None = None
    overall_rank: int | None = None
    wins: int | None = None
    losses: int | None = None
    # Whether this team's rostered players' real NFL games have yet to start, are in
    # progress, or are all done — "pending"/"live"/"finished".
    status: PlayStatus = "pending"
    roster: list[BoxscorePlayer]


class BoxscoreMatchup(BaseModel):
    week: int
    home: BoxscoreTeam
    away: BoxscoreTeam
    # Combined matchup status: "live" if either side is live, "finished" if both sides
    # are finished, "pending" otherwise.
    status: PlayStatus = "pending"


class RegularMatchup(BaseModel):
    league_name: str
    week: int
    home: TeamRef
    home_logo: str
    home_score: float
    away: TeamRef
    away_logo: str
    away_score: float
