import json
from pathlib import Path

def load_fixture(name: str) -> list[list[str]]:
    path = Path(__file__).parent / "fixtures" / name
    with open(path) as f:
        data = json.load(f)
    return data["board"]