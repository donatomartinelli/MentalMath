import re
import json
import hashlib
from pathlib import Path

# Configurazione percorsi
DOCS_DIR = Path("Documenti")
JSON_PATH = Path("problems.json")

# Regex per catturare: \item \tagprob{Topic}{Livello} Testo dell'esercizio
PATTERN = re.compile(
    r'\\item\s+\\tagprob\{([^}]+)\}\{([^}]+)\}(.*?)(?=\\item\s+\\tagprob|\\end\{enumerate\})', 
    re.DOTALL
)

def get_hash(text):
    """Genera un ID corto e univoco (8 caratteri) basato sul testo del problema."""
    return hashlib.sha256(text.strip().encode('utf-8')).hexdigest()[:8].upper()

def sync_database():
    # 1. Carica il JSON esistente (per garantire l'idempotenza e non resettare lo Spaced Repetition)
    existing_problems = []
    if JSON_PATH.exists():
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            try:
                existing_problems = json.load(f)
            except json.JSONDecodeError:
                existing_problems = []
                
    existing_ids = {p['id'] for p in existing_problems}
    
    added = 0
    skipped = 0

    # 2. Scansione dinamica: Documenti/Materia/Modulo/chapters/*.tex
    for tex_file in DOCS_DIR.rglob("chapters/*.tex"):
        parts = tex_file.parts
        if len(parts) < 4:
            continue
            
        core = parts[1]      # es. "Analisi"
        course = parts[2]    # es. "01-PreAnalisi"
        
        content = tex_file.read_text(encoding='utf-8')
        matches = PATTERN.findall(content)
        
        for topic, difficulty, statement in matches:
            topic = topic.strip()
            diff_val = float(difficulty.strip())
            statement = statement.strip()
            
            # Pulisce eventuali rimasugli di \end{multicols}
            statement = re.sub(r'\\end\{multicols\}', '', statement).strip()
            
            # Costruisce un ID leggibile e univoco (es. ANA-01--A1B2C3D4)
            prefix = f"{core[:3].upper()}-{course[:2].upper()}"
            prob_id = f"{prefix}-{get_hash(statement)}"
            
            # Inserisce solo se non esiste già
            if prob_id not in existing_ids:
                existing_problems.append({
                    "id": prob_id,
                    "core": core,
                    "course": course,
                    "topic": topic,
                    "baseDiff": diff_val,
                    "statement": statement
                })
                existing_ids.add(prob_id)
                added += 1
            else:
                skipped += 1
                
    # 3. Salva la lista aggiornata in problems.json
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(existing_problems, f, indent=2, ensure_ascii=False)
        
    print(f"Sync completato. Aggiunti: {added} | Esistenti (Skippati): {skipped}")

if __name__ == "__main__":
    sync_database()