import os
from dotenv import load_dotenv
from graph.workflow import build_graph

load_dotenv()


def main():
    if not os.getenv("AI_KEY"):
        raise ValueError("OPENAI_API_KEY not found.")

    graph = build_graph()

    initial_state = {
        "user_request": "I want a student laptop under 1500 NZD with good battery life and decent performance for coding.",
        "category": "",
        "parsed_preferences": {},
        "candidates": [],
        "shortlisted": [],
        "recommendation": None,
    }

    result = graph.invoke(initial_state)
    print("\n=== FINAL RESULT ===\n")
    print(result["recommendation"])


if __name__ == "__main__":
    main()