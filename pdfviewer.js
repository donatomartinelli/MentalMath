// MATH-HUB // LETTORE PDF NATIVO (pdf.js su canvas, stile terminale, colori invertiti)
// Pagine disegnate solo quando entrano in vista, livello di testo selezionabile, link interni,
// indice dai segnalibri del PDF, ricerca, zoom e scorciatoie da tastiera.
const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/';
let pdfjsPromise = null;
const loadPdfjs = () => pdfjsPromise ||= import(`${PDFJS_BASE}build/pdf.min.mjs`).then(lib => {
    lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}build/pdf.worker.min.mjs`;
    return lib;
});

const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } }
};

const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
    }
    n.append(...children.filter(c => c !== null && c !== undefined));
    return n;
};

const KEEP_RENDERED = 10;      // pagine disegnate tenute in memoria
const MAX_CANVAS_PX = 16e6;    // limite di pixel per canvas (zoom alti su schermi densi)
const ZOOM_STEP = 1.15;

// negativo dei pixel del canvas: 'difference' con il bianco inverte i colori e rifarlo li ripristina
const flip = (canvas) => {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
};

export class PdfViewer {
    constructor(root) {
        this.root = root;
        this.url = null;
        this.doc = null;
        this.pages = [];           // [{ div, canvas, text, links, w, h, task, rendered }]
        this.base = null;          // dimensioni della pagina 1 a scala 1 (punti PDF)
        this.scale = 1;
        this.fit = store.get('pdfFit', true);
        this.invert = store.get('pdfInvert', true);
        this.current = 1;
        this.index = null;         // testo di ogni pagina, per la ricerca
        this.hits = [];
        this.query = '';
        this.onPage = null;        // callback(page) quando cambia la pagina corrente
        this.build();
    }

    // --- interfaccia ------------------------------------------------------------
    build() {
        const btn = (text, title, fn) => el('button', { class: 'pdf-btn', type: 'button', title, text, onclick: fn });
        this.pageInput = el('input', { class: 'pdf-page-input', type: 'text', inputmode: 'numeric', 'aria-label': 'Pagina', value: '1' });
        this.pageTotal = el('span', { class: 'dim', text: '/ -' });
        this.zoomLabel = el('span', { class: 'pdf-zoom dim', text: '100%' });
        this.searchInput = el('input', { class: 'pdf-search', type: 'search', placeholder: '/ cerca nel pdf', 'aria-label': 'Cerca nel PDF' });
        this.searchInfo = el('span', { class: 'dim small pdf-search-info' });
        this.invertBtn = btn('', 'Inverti colori (i)', () => this.setInvert(!this.invert));
        this.fitBtn = btn('[ fit ]', 'Adatta alla larghezza (0)', () => { this.fit = true; store.set('pdfFit', true); this.relayout(); });
        this.outlineBtn = btn('[ indice ]', 'Indice (t)', () => this.toggleOutline());

        this.controls = el('div', { class: 'pdf-controls' },
            el('span', { class: 'pdf-group' },
                this.outlineBtn),
            el('span', { class: 'pdf-group' },
                btn('[ < ]', 'Pagina precedente (p)', () => this.goTo(this.current - 1)),
                el('span', { class: 'dim' }, 'pag '), this.pageInput, this.pageTotal,
                btn('[ > ]', 'Pagina successiva (n)', () => this.goTo(this.current + 1))),
            el('span', { class: 'pdf-group' },
                btn('[ - ]', 'Riduci (-)', () => this.zoom(1 / ZOOM_STEP)), this.zoomLabel,
                btn('[ + ]', 'Ingrandisci (+)', () => this.zoom(ZOOM_STEP)), this.fitBtn),
            el('span', { class: 'pdf-group grow' }, this.searchInput, this.searchInfo),
            el('span', { class: 'pdf-group' },
                this.invertBtn,
                btn('[ ⛶ ]', 'Schermo intero (f)', () => this.toggleFullscreen())));

        this.outline = el('nav', { class: 'pdf-outline hidden', 'aria-label': 'Indice del PDF' });
        this.pagesBox = el('div', { class: 'pdf-pages' });
        this.status = el('div', { class: 'pdf-status dim' });
        this.scroller = el('div', { class: 'pdf-scroll', tabindex: '0' }, this.status, this.pagesBox);
        this.shell = el('div', { class: 'pdf-shell' }, this.outline, this.scroller);
        this.root.replaceChildren(this.controls, this.shell);
        this.setInvert(this.invert);

        this.pageInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); this.goTo(parseInt(this.pageInput.value, 10) || this.current); this.scroller.focus({ preventScroll: true }); }
            if (e.key === 'Escape') { this.pageInput.value = this.current; this.scroller.focus({ preventScroll: true }); }
        });
        this.pageInput.addEventListener('focus', () => this.pageInput.select());
        this.searchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); this.search(this.searchInput.value, e.shiftKey ? -1 : 1); }
            if (e.key === 'Escape') { this.searchInput.blur(); this.scroller.focus({ preventScroll: true }); }
        });
        this.searchInput.addEventListener('input', () => { if (!this.searchInput.value) this.clearSearch(); });

        let ticking = false;
        this.scroller.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => { ticking = false; this.trackPage(); this.renderNear(); });
        }, { passive: true });

        this.observer = new IntersectionObserver(entries => {
            for (const e of entries) if (e.isIntersecting) this.renderPage(+e.target.dataset.page);
        }, { root: this.scroller, rootMargin: '120% 0px' });

        let resizeTimer;
        new ResizeObserver(() => {
            if (!this.doc || !this.fit) return;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.relayout(), 120);
        }).observe(this.scroller);

        document.addEventListener('keydown', e => this.onKey(e));
        document.addEventListener('fullscreenchange', () => this.root.classList.toggle('is-fullscreen', document.fullscreenElement === this.root));
    }

    visible() { return this.root.offsetParent !== null || document.fullscreenElement === this.root; }

    onKey(e) {
        if (!this.doc || !this.visible() || e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target.tagName;
        if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
        const keys = {
            n: () => this.goTo(this.current + 1), p: () => this.goTo(this.current - 1),
            '+': () => this.zoom(ZOOM_STEP), '=': () => this.zoom(ZOOM_STEP), '-': () => this.zoom(1 / ZOOM_STEP),
            0: () => { this.fit = true; store.set('pdfFit', true); this.relayout(); },
            i: () => this.setInvert(!this.invert), t: () => this.toggleOutline(), f: () => this.toggleFullscreen(),
            g: () => this.pageInput.focus(), '/': () => this.searchInput.focus(),
            Home: () => this.goTo(1), End: () => this.goTo(this.pages.length),
        };
        const fn = keys[e.key];
        if (fn) { e.preventDefault(); fn(); }
    }

    setInvert(on) {
        this.invert = on;
        store.set('pdfInvert', on);
        this.shell.classList.toggle('pdf-invert', on);
        for (const p of this.pages) if (p.rendered && p.inverted !== on) { flip(p.canvas); p.inverted = on; }
        this.invertBtn.textContent = on ? '[ ◐ nero ]' : '[ ◑ bianco ]';
    }

    toggleOutline(force) {
        const show = force ?? this.outline.classList.contains('hidden');
        this.outline.classList.toggle('hidden', !show);
        this.outlineBtn.classList.toggle('on', show);
        if (this.fit) this.relayout();
    }

    toggleFullscreen() {
        if (document.fullscreenElement) document.exitFullscreen();
        else this.root.requestFullscreen?.().catch(() => {});
    }

    // --- apertura ---------------------------------------------------------------
    async open(url, page = 1) {
        if (url === this.url && this.doc) { this.goTo(page || 1, false); return; }
        this.close();
        this.url = url;
        this.status.textContent = 'caricamento pdf...';
        this.status.classList.remove('hidden');
        try {
            const lib = this.lib = await loadPdfjs();
            const task = lib.getDocument({
                url,
                cMapUrl: `${PDFJS_BASE}cmaps/`, cMapPacked: true,
                standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`,
            });
            this.loadingTask = task;
            task.onProgress = ({ loaded, total }) => {
                if (total) this.status.textContent = `caricamento pdf... ${Math.round(loaded / total * 100)}%`;
            };
            const doc = await task.promise;
            if (this.url !== url) { doc.destroy(); return; }
            this.doc = doc;
            const first = await doc.getPage(1);
            const vp = first.getViewport({ scale: 1 });
            this.base = { w: vp.width, h: vp.height };
            this.pageTotal.textContent = `/ ${doc.numPages}`;
            this.pages = Array.from({ length: doc.numPages }, (_, i) => this.makePage(i + 1));
            this.pagesBox.append(...this.pages.map(p => p.div));
            this.status.classList.add('hidden');
            this.computeScale();
            this.layout();
            this.pages.forEach(p => this.observer.observe(p.div));
            this.goTo(page || 1, false);
            this.loadOutline();
        } catch (err) {
            if (this.url !== url) return;
            console.error(err);
            this.status.textContent = `impossibile aprire il pdf (${err?.message || err}). usa [ apri ] o [ scarica ].`;
        }
    }

    close() {
        this.loadingTask?.destroy();
        this.pages.forEach(p => { p.task?.cancel(); this.observer.unobserve(p.div); });
        this.doc?.destroy();
        this.doc = null; this.url = null; this.pages = []; this.index = null; this.hits = []; this.query = '';
        this.pagesBox.replaceChildren();
        this.outline.replaceChildren();
        this.searchInput.value = ''; this.searchInfo.textContent = '';
    }

    makePage(n) {
        const canvas = el('canvas');
        const text = el('div', { class: 'textLayer' });
        const links = el('div', { class: 'pdf-links' });
        const div = el('div', { class: 'pdf-page', 'data-page': n }, canvas, text, links,
            el('span', { class: 'pdf-page-num', text: String(n) }));
        return { n, div, canvas, text, links, w: this.base.w, h: this.base.h, task: null, rendered: false, scale: 0 };
    }

    // --- scala e impaginazione --------------------------------------------------
    computeScale() {
        if (!this.fit) return;
        const avail = this.scroller.clientWidth - 32;
        this.scale = Math.max(0.3, Math.min(avail, 1000) / this.base.w);
    }

    layout() {
        for (const p of this.pages) {
            p.div.style.width = `${Math.floor(p.w * this.scale)}px`;
            p.div.style.height = `${Math.floor(p.h * this.scale)}px`;
            p.div.style.setProperty('--scale-factor', this.scale);
        }
        this.zoomLabel.textContent = `${Math.round(this.scale * 100)}%`;
        this.fitBtn.classList.toggle('on', this.fit);
    }

    // ricalcola le dimensioni mantenendo la posizione di lettura
    relayout() {
        if (!this.doc) return;
        const p = this.pages[this.current - 1];
        const frac = p ? (this.scroller.scrollTop - p.div.offsetTop) / p.div.offsetHeight : 0;
        this.computeScale();
        this.layout();
        if (p) this.scroller.scrollTop = p.div.offsetTop + frac * p.div.offsetHeight;
        this.renderNear();
    }

    zoom(f) {
        this.fit = false;
        store.set('pdfFit', false);
        this.scale = Math.max(0.3, Math.min(5, this.scale * f));
        this.relayout();
    }

    renderNear() {
        const top = this.scroller.scrollTop, bottom = top + this.scroller.clientHeight;
        for (const p of this.pages) {
            const a = p.div.offsetTop, b = a + p.div.offsetHeight;
            if (b > top - this.scroller.clientHeight && a < bottom + this.scroller.clientHeight) this.renderPage(p.n);
        }
    }

    trackPage() {
        const mid = this.scroller.scrollTop + this.scroller.clientHeight / 3;
        let lo = 0, hi = this.pages.length - 1;
        while (lo < hi) {
            const m = (lo + hi + 1) >> 1;
            if (this.pages[m].div.offsetTop <= mid) lo = m; else hi = m - 1;
        }
        const n = lo + 1;
        if (n !== this.current) {
            this.current = n;
            if (document.activeElement !== this.pageInput) this.pageInput.value = n;
            this.onPage?.(n);
        }
    }

    goTo(n, smooth = true, yInPage = 0) {
        if (!this.pages.length) return;
        n = Math.max(1, Math.min(this.pages.length, n | 0));
        const p = this.pages[n - 1];
        this.scroller.scrollTo({ top: p.div.offsetTop - 8 + yInPage, behavior: smooth ? 'smooth' : 'auto' });
        this.current = n;
        this.pageInput.value = n;
        this.onPage?.(n);
        this.renderPage(n);
    }

    // --- disegno ----------------------------------------------------------------
    async renderPage(n) {
        const p = this.pages[n - 1];
        if (!p || !this.doc || p.scale === this.scale || p.task) return;
        const doc = this.doc, scale = this.scale;
        try {
            const page = await doc.getPage(n);
            if (doc !== this.doc) return;
            const vp = page.getViewport({ scale });
            const vp1 = page.getViewport({ scale: 1 });
            if (Math.abs(vp1.width - p.w) > 0.5 || Math.abs(vp1.height - p.h) > 0.5) {
                p.w = vp1.width; p.h = vp1.height;
                p.div.style.width = `${Math.floor(vp.width)}px`;
                p.div.style.height = `${Math.floor(vp.height)}px`;
            }
            const dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(MAX_CANVAS_PX / (vp.width * vp.height)));
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(vp.width * dpr);
            canvas.height = Math.floor(vp.height * dpr);
            canvas.style.width = `${Math.floor(vp.width)}px`;
            canvas.style.height = `${Math.floor(vp.height)}px`;
            p.task = page.render({
                canvasContext: canvas.getContext('2d', { alpha: false }),
                viewport: vp,
                transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
            });
            await p.task.promise;
            p.task = null;
            if (doc !== this.doc || scale !== this.scale) { this.renderPage(n); return; }
            if (this.invert) flip(canvas);
            p.inverted = this.invert;
            p.canvas.replaceWith(canvas);
            p.canvas = canvas;
            p.rendered = true;
            p.scale = scale;
            p.div.classList.add('ready');
            this.renderText(p, page, vp);
            this.renderLinks(p, page, vp);
            this.evict();
        } catch (err) {
            p.task = null;
            if (err?.name !== 'RenderingCancelledException') console.warn('pagina', n, err);
        }
    }

    async renderText(p, page, vp) {
        p.text.replaceChildren();
        const layer = new this.lib.TextLayer({ textContentSource: page.streamTextContent(), container: p.text, viewport: vp });
        await layer.render();
        if (this.query) this.highlight(p);
    }

    async renderLinks(p, page, vp) {
        p.links.replaceChildren();
        const annots = await page.getAnnotations({ intent: 'display' });
        for (const a of annots) {
            if (a.subtype !== 'Link' || (!a.dest && !a.url)) continue;
            const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
            const link = el('a', { class: 'pdf-link' });
            Object.assign(link.style, {
                left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`,
                width: `${Math.abs(x2 - x1)}px`, height: `${Math.abs(y2 - y1)}px`,
            });
            if (a.url) Object.assign(link, { href: a.url, target: '_blank', rel: 'noopener' });
            else {
                link.href = '#';
                link.addEventListener('click', e => { e.preventDefault(); this.followDest(a.dest); });
            }
            p.links.append(link);
        }
    }

    async followDest(dest) {
        try {
            const explicit = typeof dest === 'string' ? await this.doc.getDestination(dest) : dest;
            if (!explicit) return;
            const n = (await this.doc.getPageIndex(explicit[0])) + 1;
            let y = 0;
            if (explicit[1]?.name === 'XYZ' && explicit[3] != null) {
                const page = await this.doc.getPage(n);
                y = Math.max(0, page.getViewport({ scale: this.scale }).convertToViewportPoint(0, explicit[3])[1] - 24);
            }
            this.goTo(n, false, y);
        } catch (err) { console.warn('link', err); }
    }

    unrender(p) {
        p.task?.cancel(); p.task = null;
        p.rendered = false; p.scale = 0;
        p.div.classList.remove('ready');
        const blank = document.createElement('canvas');
        p.canvas.replaceWith(blank); p.canvas = blank;
        p.text.replaceChildren(); p.links.replaceChildren();
    }

    evict() {
        const done = this.pages.filter(p => p.rendered);
        if (done.length <= KEEP_RENDERED) return;
        done.sort((a, b) => Math.abs(b.n - this.current) - Math.abs(a.n - this.current));
        done.slice(0, done.length - KEEP_RENDERED).forEach(p => this.unrender(p));
    }

    // --- indice -----------------------------------------------------------------
    async loadOutline() {
        const doc = this.doc;
        const items = await doc.getOutline().catch(() => null);
        if (doc !== this.doc) return;
        this.outline.replaceChildren();
        if (!items?.length) {
            this.outline.append(el('p', { class: 'dim small', text: 'nessun segnalibro in questo pdf' }));
            return;
        }
        const list = (arr, depth) => el('ul', { class: `depth-${depth}` }, ...arr.map(it => el('li', {},
            el('a', {
                href: '#', text: it.title,
                onclick: e => {
                    e.preventDefault();
                    if (it.dest) this.followDest(it.dest);
                    else if (it.url) window.open(it.url, '_blank', 'noopener');
                    if (window.matchMedia('(max-width: 700px)').matches) this.toggleOutline(false);
                }
            }),
            depth < 2 && it.items?.length ? list(it.items, depth + 1) : null)));
        this.outline.append(el('div', { class: 'pdf-outline-title', text: '// indice' }), list(items, 0));
    }

    // --- ricerca ----------------------------------------------------------------
    async buildIndex() {
        if (this.index) return this.index;
        const doc = this.doc, out = [];
        for (let i = 1; i <= doc.numPages; i++) {
            if (doc !== this.doc) return null;
            if (i % 20 === 1) this.searchInfo.textContent = `indicizzo ${i}/${doc.numPages}`;
            const page = await doc.getPage(i);
            const tc = await page.getTextContent();
            out.push(tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ').toLowerCase());
        }
        this.index = out;
        return out;
    }

    async search(raw, dir = 1) {
        const q = raw.trim().toLowerCase();
        if (!q || !this.doc) { this.clearSearch(); return; }
        if (q !== this.query) {
            const index = await this.buildIndex();
            if (!index) return;
            this.query = q;
            this.hits = index.flatMap((t, i) => t.includes(q) ? [i + 1] : []);
            this.pages.filter(p => p.rendered).forEach(p => this.highlight(p));
        }
        if (!this.hits.length) { this.searchInfo.textContent = 'nessun risultato'; return; }
        const len = this.hits.length;
        let k;
        if (q !== this.lastQ) { k = this.hits.findIndex(n => n >= this.current); if (k < 0) k = 0; }
        else k = (this.hitCursor + dir + len) % len;
        this.lastQ = q; this.hitCursor = k;
        this.searchInfo.textContent = `${k + 1}/${this.hits.length} · pag ${this.hits[k]}`;
        this.goTo(this.hits[k], false);
    }

    clearSearch() {
        this.query = ''; this.hits = []; this.lastQ = undefined; this.hitCursor = 0;
        this.searchInfo.textContent = '';
        this.pages.forEach(p => p.text.querySelectorAll('.hit').forEach(s => s.classList.remove('hit')));
    }

    highlight(p) {
        p.text.querySelectorAll('.hit').forEach(s => s.classList.remove('hit'));
        if (!this.query || !this.hits.includes(p.n)) return;
        for (const span of p.text.querySelectorAll('span')) {
            if (span.textContent.replace(/\s+/g, ' ').toLowerCase().includes(this.query)) span.classList.add('hit');
        }
    }
}
