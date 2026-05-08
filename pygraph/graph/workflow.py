from langgraph.graph import StateGraph, START, END
from graph.state import CompareState
from graph.nodes import (
    parse_request_node,
    load_candidates_node,
    shortlist_node,
    recommend_node,
)


def build_graph():
    builder = StateGraph(CompareState)

    builder.add_node("parse_request", parse_request_node)
    builder.add_node("load_candidates", load_candidates_node)
    builder.add_node("shortlist", shortlist_node)
    builder.add_node("recommend", recommend_node)

    builder.add_edge(START, "parse_request")
    builder.add_edge("parse_request", "load_candidates")
    builder.add_edge("load_candidates", "shortlist")
    builder.add_edge("shortlist", "recommend")
    builder.add_edge("recommend", END)

    return builder.compile()