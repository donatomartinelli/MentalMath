import re
import json
import hashlib
from pathlib import Path

# Configurazione percorsi
DOCS_DIR = Path("Documenti")
JSON_PATH = Path("problems.json")

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
                
    # Mappa gli esercizi esistenti per non perdere lo storico Anki
    existing_map = {p['id']: p for p in existing_problems}
    new_problems_list = []
    
    added = 0
    skipped = 0

    # IL SEGRETO È QUI: sorted() garantisce che legga 01_preanalisi, 02_equazioni, ecc. in ordine
    for tex_file in sorted(DOCS_DIR.rglob("chapters/*.tex")):
        parts = tex_file.parts
        if len(parts) < 4:
            continue
            
        core = parts[1]      
        course = parts[2]    
        
        content = tex_file.read_text(encoding='utf-8')
        matches = PATTERN.findall(content)
        
        for topic, difficulty, statement in matches:
            topic = topic.strip()
            diff_val = float(difficulty.strip())
            statement = re.sub(r'\\end\{multicols\}', '', statement).strip()
            
            prefix = f"{core[:3].upper()}-{course[:2].upper()}"
            prob_id = f"{prefix}-{get_hash(statement)}"
            
            # Se esiste, lo ripesca (con le sue statistiche intatte), altrimenti lo crea
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
                
    # Sovrascrive il JSON garantendo che l'array sia perfettamente in ordine
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(new_problems_list, f, indent=2, ensure_ascii=False)
        
    print(f"Sync completato. Nuovi aggiunti: {added} | Esistenti mantenuti: {skipped}")

if __name__ == "__main__":
    sync_database()