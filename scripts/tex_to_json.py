#!/usr/bin/env python3
"""
MATH-HUB // LATEX TO JSON COMPILER
Estrae gli esercizi dal mega-documento LaTeX strutturato in \part, \chapter, \section
e aggiorna problems.json mantenendo intatti gli ID immutabili e ignorando i blocchi \begin{soluzione}.
Uso:
    python scripts/tex_to_json.py latex-src/esercizi_master.tex problems.json
"""
import re
import sys
import json
from pathlib import Path

TOKEN_RE = re.compile(
    r'\\part\{([^}]+)\}|'
    r'\\chapter\{([^}]+)\}|'
    r'\\section\{([^}]+)\}|'
    r'\\begin\{esercizio\}\{([^}]+)\}\{([^}]+)\}(.*?)\\end\{esercizio\}',
    re.DOTALL
)

def parse_tex_file(tex_path: Path):
    content = tex_path.read_text(encoding='utf-8')
    core = "Analisi"
    course = "Pre-Analisi"
    topic = "Generale"
    problems = []
    seen_ids = set()

    for match in TOKEN_RE.finditer(content):
        p, c, s, ex_id, diff, body = match.groups()
        if p:
            core = p.strip()
        elif c:
            course = c.strip()
        elif s:
            topic = s.strip()
        elif ex_id:
            clean_id = ex_id.strip()
            if clean_id in seen_ids:
                print(f"[ATTENZIONE] ID duplicato rilevato nel LaTeX: {clean_id}")
            seen_ids.add(clean_id)
            problems.append({
                "id": clean_id,
                "core": core,
                "course": course,
                "topic": topic,
                "baseDiff": float(diff.strip()),
                "statement": body.strip()
            })

    return problems

def main():
    in_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("latex-src/esercizi_master.tex")
    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("problems.json")

    if not in_path.exists():
        print(f"Errore: file sorgente {in_path} non trovato.")
        sys.exit(1)

    problems = parse_tex_file(in_path)
    out_path.write_text(json.dumps(problems, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] Estratti {len(problems)} esercizi da '{in_path}' -> salvati in '{out_path}'.")

if __name__ == "__main__":
    main()
