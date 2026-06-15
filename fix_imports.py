import os
import glob

# Fix main_v2.py
main_file = "backend/main_v2.py"
with open(main_file, "r", encoding="utf-8") as f:
    content = f.read()
content = content.replace("from .db.database", "from db.database")
content = content.replace("from .api import", "from api import")
with open(main_file, "w", encoding="utf-8") as f:
    f.write(content)

# Fix backend/api/*.py
for file in glob.glob("backend/api/*.py"):
    with open(file, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    with open(file, "w", encoding="utf-8") as f:
        for line in lines:
            if line.startswith("from ..db.database"):
                line = line.replace("from ..db.database", "from db.database")
            elif line.startswith("from ..models"):
                line = line.replace("from ..models", "from models")
            elif line.startswith("from ..schemas"):
                line = line.replace("from ..schemas", "from schemas")
            elif line.startswith("from .auth"):
                line = line.replace("from .auth", "from api.auth")
            elif line.startswith("from .businesses"):
                line = line.replace("from .businesses", "from api.businesses")
            elif line.startswith("from .dependencies"):
                line = line.replace("from .dependencies", "from api.dependencies")
            f.write(line)

print("Imports fixed in backend!")
