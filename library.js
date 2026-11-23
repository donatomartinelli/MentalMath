// MATH-HUB // DISPENSE (PDF da math-pdf) + INDICE DEGLI ENUNCIATI (catalog.json da math-tex)
import { PDF_BASE_URL, CATALOG_URL } from './config.js';
import { texToHtml, renderMath } from './texlite.js';
import { PdfViewer } from './pdfviewer.js';

const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else n.setAttribute(k, v);
    }
    n.append(...children.filter(c => c !== null && c !== undefined));
    return n;
};

const PAGE_SIZE = 60;

export class Library {
    constructor() {
        this.manifest = null;   // { pdfs: [{ slug, title, file, pages, bytes, builtAt }] }
        this.catalog = null;    // { courses: [{slug,title}], entries: [...] }
        this.byLabel = new Map();
    }

    async load() {
        // un secondo tentativo: sul telefono una rete lenta o un cambio di rete fanno fallire la prima richiesta
        const get = (url) => fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : Promise.reject(r.status));
        const retry = (url) => get(url).catch(() => new Promise(r => setTimeout(r, 1500)).then(() => get(url)));
        const [man, cat] = await Promise.allSettled([retry(new URL('manifest.json', PDF_BASE_URL)), retry(CATALOG_URL)]);
        this.loaded = true;
        this.manifest = man.status === 'fulfilled' ? man.value : null;
        this.catalog = cat.status === 'fulfilled' ? cat.value : null;
        if (!this.manifest) console.warn('manifest PDF non disponibile', man.reason);
        this.byLabel = new Map((this.catalog?.entries || []).filter(e => e.label).map(e => [e.label, e]));
    }

    // --- dati -------------------------------------------------------------------
    courses() {
        const list = this.catalog?.courses || [];
        const fromPdf = (this.manifest?.pdfs || []).map(p => ({ slug: p.slug, title: p.title }));
        const seen = new Set();
        return [...fromPdf, ...list].filter(c => !seen.has(c.slug) && seen.add(c.slug));
    }
    courseTitle(slug) { return this.courses().find(c => c.slug === slug)?.title || slug; }
    pdf(slug) { return this.manifest?.pdfs?.find(p => p.slug === slug) || null; }
    hasPdf(slug) { return !!this.pdf(slug); }
    pdfUrl(slug, page) {
        const p = this.pdf(slug);
        if (!p) return null;
        const url = new URL(`pdf/${p.file}`, PDF_BASE_URL).href;
        return page ? `${url}#page=${page}` : url;
    }
    entries() { return this.catalog?.entries || []; }

    // --- HOME -------------------------------------------------------------------
    renderHome(nProblems) {
        const root = document.getElementById('home-body');
        root.replaceChildren();
        const line = (cmd) => el('div', { class: 'term-cmd', text: `$ ${cmd}` });

        root.append(line('whoami'),
            el('p', { class: 'term-out', text: 'math-hub: appunti di matematica, dispense PDF e allenamento. Tutto generato dai sorgenti LaTeX di math-tex.' }));

        root.append(line('ls dispense/'));
        const ul = el('ul', { class: 'term-list' });
        const pdfs = this.manifest?.pdfs || [];
        if (!pdfs.length) ul.append(el('li', { class: 'dim', text: 'nessun pdf pubblicato ancora (in attesa della CI di math-tex)' }));
        for (const p of pdfs) {
            ul.append(el('li', {},
                el('a', { href: `#/dispense/${p.slug}`, text: `${p.title.toLowerCase().replace(/\s+/g, '-')}.pdf` }),
                el('span', { class: 'dim', text: [p.pages && `${p.pages} pag`, (p.builtAt || '').slice(0, 10)].filter(Boolean).join('  ') })));
        }
        root.append(ul);

        const entries = this.entries();
        const labels = new Set(entries.map(e => e.label).filter(Boolean));
        const edges = entries.reduce((n, e) => n + (e.refs || []).filter(r => labels.has(r)).length, 0);
        const commit = (this.manifest?.sourceCommit || this.catalog?.sourceCommit || '').slice(0, 7) || '?';
        root.append(line('stat'),
            el('p', { class: 'term-out', text: `${nProblems} problemi · ${entries.length} enunciati · ${edges} dipendenze · build math-tex@${commit}` }));

        root.append(line('help'));
        const help = [
            ['dispense', 'leggi i PDF completi'],
            ['enunciati', 'cerca definizioni e teoremi'],
            ['problemi', 'esercizi con ripetizione dilazionata'],
            ['calcolo', 'calcolo mentale (Trachtenberg)'],
            ['grafo', 'mappa 3D delle dipendenze tra enunciati'],
            ['stats', 'progressi e streak'],
        ];
        const hl = el('ul', { class: 'term-list' });
        for (const [r, d] of help) hl.append(el('li', {}, el('a', { href: `#/${r}`, text: r }), el('span', { class: 'dim', text: d })));
        root.append(hl, el('div', { class: 'term-cmd cursor', text: '$ ' }));
    }

    // --- DISPENSE ---------------------------------------------------------------
    renderDispense(slug, page) {
        const list = document.getElementById('dispense-list');
        const viewer = document.getElementById('dispense-viewer');
        if (!slug) {
            viewer.classList.add('hidden');
            list.classList.remove('hidden');
            list.replaceChildren();
            const pdfs = this.manifest?.pdfs || [];
            if (!pdfs.length) {
                list.append(el('p', { class: 'dim', text: `Nessun PDF disponibile: ${PDF_BASE_URL}manifest.json non raggiungibile.` }));
                return;
            }
            const ul = el('ul', { class: 'term-list big' });
            for (const p of pdfs) {
                const n = this.entries().filter(e => e.course === p.slug).length;
                ul.append(el('li', {},
                    el('a', { href: `#/dispense/${p.slug}`, text: `[ ${p.title.toUpperCase()} ]` }),
                    el('span', { class: 'dim', text: [p.pages && `${p.pages} pag`, n && `${n} enunciati`, `${Math.round(p.bytes / 1024)} KB`, (p.builtAt || '').slice(0, 10)].filter(Boolean).join(' · ') })));
            }
            list.append(ul);
            const commit = (this.manifest.sourceCommit || '').slice(0, 7);
            list.append(el('p', { class: 'dim small', text: `// build ${String(this.manifest.generatedAt || '').slice(0, 16).replace('T', ' ')} · math-tex@${commit}` }));
            return;
        }

        list.classList.add('hidden');
        viewer.classList.remove('hidden');
        const p = this.pdf(slug);
        const bar = document.getElementById('viewer-bar');
        const box = document.getElementById('pdf-viewer');
        bar.replaceChildren();
        if (!p) {
            bar.append(el('span', { class: 'dim', text: `dispensa "${slug}" non trovata` }), el('a', { href: '#/dispense', text: '[ indietro ]' }));
            this.viewer?.close();
            return;
        }
        const raw = this.pdfUrl(slug);
        bar.append(
            el('a', { href: '#/dispense', text: '[ .. ]' }),
            el('span', { class: 'viewer-title', text: `${p.title.toLowerCase().replace(/\s+/g, '-')}.pdf` }),
            el('a', { href: `#/enunciati?corso=${slug}`, text: '[ enunciati ]' }),
            el('a', { href: `#/grafo?corso=${slug}`, text: '[ grafo ]' }),
            el('a', { href: raw, target: '_blank', rel: 'noopener', text: '[ apri ]' }),
            el('a', { href: raw, download: p.file, text: '[ scarica ]' }));

        if (!this.viewer) this.viewer = new PdfViewer(box);
        // la pagina corrente finisce nell'indirizzo senza riattivare il router (replaceState non genera hashchange)
        let t;
        this.viewer.onPage = (n) => {
            clearTimeout(t);
            t = setTimeout(() => {
                const target = `#/dispense/${slug}/${n}`;
                if (location.hash.startsWith(`#/dispense/${slug}`) && location.hash !== target) history.replaceState(null, '', target);
            }, 300);
        };
        this.viewer.open(raw, parseInt(page, 10) || 1);
    }

    // --- ENUNCIATI --------------------------------------------------------------
    renderEnunciati(query) {
        const root = document.getElementById('enunciati-body');
        const q = (query.get('q') || '').trim();
        const corso = query.get('corso') || '';
        const tipo = query.get('tipo') || '';
        const pag = Math.max(1, parseInt(query.get('p') || '1', 10));

        const form = document.getElementById('enunciati-form');
        if (!form.dataset.ready && this.catalog) this.setupEnunciatiForm(form);
        form.q.value = q; form.corso.value = corso; form.tipo.value = tipo;

        const needle = q.toLowerCase();
        const results = this.entries().filter(e =>
            (!corso || e.course === corso) && (!tipo || e.type === tipo) &&
            (!needle || [e.title, e.label, e.body, e.type].some(v => v && v.toLowerCase().includes(needle))));

        root.replaceChildren();
        if (!this.catalog) { root.append(this.missing()); return; }
        root.append(el('p', { class: 'dim small', text: `${results.length} risultati` }));

        const pageItems = results.slice((pag - 1) * PAGE_SIZE, pag * PAGE_SIZE);
        const ul = el('ul', { class: 'stmt-list' });
        for (const e of pageItems) ul.append(this.stmtItem(e, results.length <= 5));
        root.append(ul);

        const pages = Math.ceil(results.length / PAGE_SIZE);
        if (pages > 1) {
            const nav = el('div', { class: 'pager' });
            const link = (n, txt) => {
                const qs = new URLSearchParams(query); qs.set('p', n);
                return el('a', { href: `#/enunciati?${qs}`, text: txt });
            };
            if (pag > 1) nav.append(link(pag - 1, '[ < ]'));
            nav.append(el('span', { class: 'dim', text: ` ${pag}/${pages} ` }));
            if (pag < pages) nav.append(link(pag + 1, '[ > ]'));
            root.append(nav);
        }
    }

    // catalogo assente: ancora in caricamento oppure richiesta fallita
    missing() {
        if (!this.loaded) return el('p', { class: 'dim cursor', text: 'caricamento catalogo ' });
        const p = el('p', { class: 'dim', text: 'catalog.json non disponibile. ' });
        p.append(el('a', { href: '#', text: '[ riprova ]', onclick: (e) => { e.preventDefault(); location.reload(); } }));
        return p;
    }

    stmtItem(e, open = false) {
        const head = el('summary', {},
            el('span', { class: 'stmt-type', text: `${e.type.toUpperCase()}${e.number ? ' ' + e.number : ''}` }),
            el('span', { class: 'stmt-title', text: e.title || (e.label ? e.label.replace(/_/g, ' ') : '') }),
            el('span', { class: 'dim', text: this.courseTitle(e.course) + (e.page ? ` · p.${e.page}` : '') }));
        const body = el('div', { class: 'stmt-body' });
        const det = el('details', {}, head, body);
        const fill = () => {
            if (body.dataset.done) return;
            body.dataset.done = '1';
            body.innerHTML = texToHtml(e.body || '');
            renderMath(body);
            const links = el('div', { class: 'stmt-links' });
            if (this.hasPdf(e.course)) links.append(el('a', { href: `#/dispense/${e.course}${e.page ? '/' + e.page : ''}`, text: `[ apri nel pdf${e.page ? ' a pag. ' + e.page : ''} ]` }));
            if (e.label) links.append(el('a', { href: `#/grafo?corso=${e.course}&nodo=${encodeURIComponent(e.label)}`, text: '[ nel grafo ]' }));
            const deps = (e.refs || []).filter(r => this.byLabel.has(r));
            if (deps.length) links.append(el('span', { class: 'dim', text: `usa: ${deps.length}` }));
            body.append(links);
        };
        det.addEventListener('toggle', () => det.open && fill());
        if (open) { det.open = true; fill(); }
        return el('li', {}, det);
    }

    setupEnunciatiForm(form) {
        form.dataset.ready = '1';
        for (const c of this.courses()) form.corso.append(el('option', { value: c.slug, text: c.title }));
        const types = [...new Set(this.entries().map(e => e.type))].sort();
        for (const t of types) form.tipo.append(el('option', { value: t, text: t }));
        const go = () => {
            const qs = new URLSearchParams();
            if (form.q.value.trim()) qs.set('q', form.q.value.trim());
            if (form.corso.value) qs.set('corso', form.corso.value);
            if (form.tipo.value) qs.set('tipo', form.tipo.value);
            const target = `#/enunciati${qs.toString() ? '?' + qs : ''}`;
            if (location.hash !== target) location.hash = target;
        };
        form.addEventListener('submit', (ev) => { ev.preventDefault(); go(); });
        form.corso.addEventListener('change', go);
        form.tipo.addEventListener('change', go);
    }
}
