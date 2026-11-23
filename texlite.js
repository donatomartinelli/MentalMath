// MATH-HUB // LaTeX -> HTML leggero per mostrare gli enunciati (la matematica la disegna KaTeX)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function texToHtml(tex) {
    // Le parti matematiche vanno protette prima di toccare il testo
    const math = [];
    const keep = (m) => { math.push(m); return `\u0000${math.length - 1}\u0000`; };
    let s = tex
        .replace(/\\begin\{(equation|align|gather|multline)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
            (_, env, body) => keep(`\\[\\begin{${env === 'equation' ? 'aligned' : 'aligned'}}${body.replace(/\\label\{[^}]*\}/g, '').replace(/\\(nonumber|notag)/g, '')}\\end{aligned}\\]`))
        .replace(/\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$]*?\$/g, keep);

    s = esc(s)
        .replace(/%[^\n]*/g, '')
        .replace(/\\(?:textbf|emph|textit|underline)\{([^{}]*)\}/g, (m, t) => m.startsWith('\\textbf') ? `<b>${t}</b>` : `<i>${t}</i>`)
        .replace(/\\(?:ref|cref|eqref)\{([^}]*)\}/g, (_, l) => `<a class="tex-ref" href="#/enunciati?q=${encodeURIComponent(l)}">${l.replace(/_/g, ' ')}</a>`)
        .replace(/\\begin\{enumerate\}(\[[^\]]*\])?/g, '<ol>').replace(/\\end\{enumerate\}/g, '</ol>')
        .replace(/\\begin\{itemize\}(\[[^\]]*\])?/g, '<ul>').replace(/\\end\{itemize\}/g, '</ul>')
        .replace(/\\item\s*(\[[^\]]*\])?/g, '<li>')
        .replace(/\\begin\{[a-zA-Z*]+\}|\\end\{[a-zA-Z*]+\}/g, '')
        .replace(/\\(?:noindent|medskip|smallskip|bigskip|newline|par)\b/g, ' ')
        .replace(/\\\\/g, '<br>')
        .replace(/\n\s*\n/g, '<br><br>');

    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => esc(math[+i]));
}

export function renderMath(el) {
    if (!window.renderMathInElement) return;
    window.renderMathInElement(el, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false
    });
}
