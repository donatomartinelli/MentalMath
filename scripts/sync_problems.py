import re
import json
import hashlib
from pathlib import Path

# Ancoraggio dinamico: risolve la root a prescindere da dove viene lanciato lo script
ROOT_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT_DIR / "Documenti"
JSON_PATH = ROOT_DIR / "problems.json"

PATTERN = re.compile(
    r'\\item\s+\\tagprob\{([^}]+)\}\{([^}]+)\}(.*?)(?=\\item\s+\\tagprob|\\end\{enumerate\})', 
    re.DOTALL
)

def get_hash(text):
    return hashlib.sha256(text.strip().encode('utf-8')).hexdigest()[:8].upper()

def sync_database():
    existing_problems = []
    if JSON_PATH.exists():
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            try:
                existing_problems = json.load(f)
            except json.JSONDecodeError:
                pass
                
    existing_map = {p['id']: p for p in existing_problems}
    new_problems_list = []
    added = 0
    skipped = 0

    for tex_file in sorted(DOCS_DIR.rglob("chapters/*.tex")):
        # Estrae il percorso relativo alla root per mantenere l'indicizzazione delle cartelle intatta
        rel_path = tex_file.relative_to(ROOT_DIR)
        parts = rel_path.parts
        
        if len(parts) < 4:
            continue
            
        core = parts[1]      # "Documenti" è parts[0], "Analisi" è parts[1]
        course = parts[2]    # "01_preAnalisi" è parts[2]
        
        content = tex_file.read_text(encoding='utf-8')
        matches = PATTERN.findall(content)
        
        for topic, difficulty, statement in matches:
            topic = topic.strip()
            diff_val = float(difficulty.strip())
            statement = re.sub(r'\\end\{multicols\}', '', statement).strip()
            
            prefix = f"{core[:3].upper()}-{course[:2].upper()}"
            prob_id = f"{prefix}-{get_hash(statement)}"
            
            if prob_id in existing_map:
                new_problems_list.append(existing_map[prob_id])
                skipped += 1
            else:
                new_problems_list.append({
                    "id": prob_id,
                    "core": core,
                    "course": course,
                    "topic": topic,
                    "baseDiff": diff_val,
                    "statement": statement
                })
                added += 1
                
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_problems_list, f, indent=2, ensure_ascii=False)
        
    print(f"Sync completato. Nuovi aggiunti: {added} | Esistenti mantenuti: {skipped}")

if __name__ == "__main__":
    sync_database()
