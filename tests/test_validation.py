from scraper.extract_board import validate_board

sample_board = [
    ["I", "R", "B", "C"],
    ["M", "W", "R", "O"],
    ["G", "G", "R", "R"],
    ["I", "P", "B", "M"],
    ["P", "P", "M", "B"],
    ["C", "O", "I", "C"],
    ["Y", "B", "Y", "G"],
    ["I", "W", "M", "O"],
    ["G", "C", "Y", "Y"],
    ["W", "O", "W", "P"],
    [],
    [],
]

validate_board(sample_board)
print("✅ Valid board passed as expected.")

# Now recreate the old bug on purpose — indigo miscoded as blue
broken_board = [
    ["B", "R", "B", "C"],
    ["M", "W", "R", "O"],
    ["G", "G", "R", "R"],
    ["B", "P", "B", "M"],
    ["P", "P", "M", "B"],
    ["C", "O", "B", "C"],
    ["Y", "B", "Y", "G"],
    ["B", "W", "M", "O"],
    ["G", "C", "Y", "Y"],
    ["W", "O", "W", "P"],
    [],
    [],
]

try:
    validate_board(broken_board)
    print("❌ Bug: broken board should have raised ValueError but didn't.")
except ValueError as e:
    print(f"✅ Broken board correctly rejected: {e}")

