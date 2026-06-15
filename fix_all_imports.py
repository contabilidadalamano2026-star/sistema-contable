import os

def fix_file(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace relative imports that cross boundaries
    content = content.replace("from ..db.database", "from db.database")
    content = content.replace("from ..models", "from models")
    content = content.replace("from ..schemas", "from schemas")
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)

for root, dirs, files in os.walk("backend"):
    for file in files:
        if file.endswith(".py"):
            fix_file(os.path.join(root, file))

print("All imports fixed in backend!")
