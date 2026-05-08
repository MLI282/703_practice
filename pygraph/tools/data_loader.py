import json
from pathlib import Path


def load_products():
    path = Path("data/products.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_places():
    path = Path("data/places.json")
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)