from datetime import datetime, timedelta, timezone

from styrelseautomation.scoring import score_opportunity
from styrelseautomation.storage import Opportunity

PROFILE = {
    "keywords": {
        "core": [
            {"term": "ai", "weight": 3.0},
            {"term": "digitalisering", "weight": 3.0},
            {"term": "transformation", "weight": 2.0},
        ],
        "boost": [
            {"term": "valberedning", "weight": 1.5},
            {"term": "ledamot sökes", "weight": 2.0},
        ],
        "negative": [
            {"term": "junior", "weight": -1.0},
        ],
    },
    "filters": {
        "min_score": 1.0,
        "locations_allow": ["sverige", "stockholm"],
        "blocked_industries": [],
        "max_age_days": 30,
    },
}


def _opp(**kwargs):
    base = dict(title="Test", source="test")
    base.update(kwargs)
    return Opportunity(**base)


def test_core_keywords_match():
    opp = _opp(title="Styrelseledamot med AI-kompetens sökes",
               summary="Fokus på digitalisering och transformation",
               location="Stockholm")
    result = score_opportunity(opp, PROFILE)
    assert result.score >= 8.0
    assert "ai" in result.matched
    assert "digitalisering" in result.matched


def test_location_filter_blocks():
    opp = _opp(title="AI-ledamot", summary="digitalisering", location="Oslo")
    result = score_opportunity(opp, PROFILE)
    assert result.rejected_reason == "location"


def test_negative_keyword_reduces_score():
    opp = _opp(title="AI digitalisering", summary="junior roll", location="Sverige")
    result = score_opportunity(opp, PROFILE)
    assert result.score < 6.0
    assert "junior" in result.matched


def test_old_posting_filtered():
    old = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    opp = _opp(title="AI digitalisering", location="Stockholm", posted_at=old)
    result = score_opportunity(opp, PROFILE)
    assert result.rejected_reason == "too old"


def test_boost_keyword_applies():
    opp = _opp(title="Valberedning söker AI-expert",
               summary="digitalisering och transformation",
               location="Sverige")
    result = score_opportunity(opp, PROFILE)
    assert "valberedning" in result.matched


def test_empty_location_passes():
    opp = _opp(title="AI digitalisering styrelse", location="")
    result = score_opportunity(opp, PROFILE)
    assert result.rejected_reason is None
