from langchain_openai import ChatOpenAI
from graph.state import CompareState
from tools.data_loader import load_products, load_places
import json
import os

def get_llm():
    api_key = os.getenv("AI_KEY") or os.getenv("DEEPSEEK_API_KEY")

    if not api_key:
        raise ValueError("API KEY not found")

    return ChatOpenAI(
        model="deepseek-v4-flash",
        openai_api_key=api_key,
        openai_api_base="https://api.deepseek.com",
        temperature=0
    )


def parse_request_node(state: CompareState):
    prompt = f"""
You are an assistant that extracts structured shopping or place-search preferences.

User request:
{state["user_request"]}

Return ONLY valid JSON with this structure:
{{
  "category": "product" or "place",
  "budget_nzd": number or null,
  "preferred_features": [string],
  "use_case": string
}}
"""
    llm=get_llm()
    response = llm.invoke(prompt)
    text = response.content if isinstance(response.content, str) else str(response.content)

    try:
        parsed = json.loads(text)
    except Exception:
        parsed = {
            "category": "product",
            "budget_nzd": None,
            "preferred_features": [],
            "use_case": state["user_request"]
        }

    return {
        "category": parsed.get("category", "product"),
        "parsed_preferences": parsed
    }


def load_candidates_node(state: CompareState):
    if state["category"] == "place":
        candidates = load_places()
    else:
        candidates = load_products()

    return {"candidates": candidates}


def shortlist_node(state: CompareState):
    prefs = state["parsed_preferences"]
    budget = prefs.get("budget_nzd")
    candidates = state["candidates"]

    filtered = candidates
    if budget is not None:
        filtered = [
            item for item in candidates
            if item.get("price_nzd") is None or item.get("price_nzd") <= budget
        ]

    return {"shortlisted": filtered[:5]}


def recommend_node(state: CompareState):
    prefs = state["parsed_preferences"]
    shortlisted = state["shortlisted"]

    prompt = f"""
You are a recommendation assistant.

User preferences:
{json.dumps(prefs, ensure_ascii=False, indent=2)}

Candidates:
{json.dumps(shortlisted, ensure_ascii=False, indent=2)}

Write:
1. Top recommendation
2. Short comparison
3. Why it fits the user
4. Which option is best value

Keep it concise but useful.
"""
    llm=get_llm()
    response = llm.invoke(prompt)
    text = response.content if isinstance(response.content, str) else str(response.content)

    return {"recommendation": text}