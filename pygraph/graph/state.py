from typing import TypedDict, List, Dict, Any, Optional


class CompareState(TypedDict):
    user_request: str
    category: str
    parsed_preferences: Dict[str, Any]
    candidates: List[Dict[str, Any]]
    shortlisted: List[Dict[str, Any]]
    recommendation: Optional[str]