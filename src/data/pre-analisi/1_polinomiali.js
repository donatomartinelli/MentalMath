export const polinomiali = [
    // --- RACCOGLIMENTO ---
    {
        id: "pre_poli_001",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Raccoglimento Parziale",
        theory_snippet: "Isola i gruppi di monomi. Obiettivo: far comparire una parentesi in comune da raccogliere a sua volta.",
        problem_tex: "x^3 - 3x^2 - 4x + 12 = 0",
        solution_tex: "x_1 = -2, \\; x_2 = 2, \\; x_3 = 3",
        steps_tex: []
    },
    {
        id: "pre_poli_002",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Raccoglimento Parziale",
        theory_snippet: "Se c'è un termine di grado dispari e uno pari, raggruppa in modo da fattorizzare la differenza di cubi o quadrati.",
        problem_tex: "x^4 - x^3 - 8x + 8 = 0",
        solution_tex: "x_1 = 1, \\; x_2 = 2 \\quad \\text{(radici reali)}",
        steps_tex: []
    },
    {
        id: "pre_poli_003",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Raccoglimento Parziale",
        theory_snippet: "Fai attenzione ai segni quando metti in evidenza un termine negativo nel secondo gruppo.",
        problem_tex: "2x^3 + x^2 - 18x - 9 = 0",
        solution_tex: "x_1 = -3, \\; x_2 = -\\frac{1}{2}, \\; x_3 = 3",
        steps_tex: []
    },

    // --- RUFFINI E RICERCA RADICI ---
    {
        id: "pre_poli_004",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Regola di Ruffini",
        theory_snippet: "Testa i divisori del termine noto. Se la somma dei coefficienti è zero, x=1 è sicuramente radice.",
        problem_tex: "x^3 - 2x^2 - 5x + 6 = 0",
        solution_tex: "x_1 = -2, \\; x_2 = 1, \\; x_3 = 3",
        steps_tex: []
    },
    {
        id: "pre_poli_005",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Regola di Ruffini",
        theory_snippet: "Ricorda di inserire lo zero nella griglia di Ruffini per i gradi mancanti (es. termine in x^2).",
        problem_tex: "x^3 - 7x + 6 = 0",
        solution_tex: "x_1 = -3, \\; x_2 = 1, \\; x_3 = 2",
        steps_tex: []
    },
    {
        id: "pre_poli_006",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Regola di Ruffini (Radici Razionali)",
        theory_snippet: "Se il coefficiente direttivo non è 1, le radici razionali vanno cercate tra (divisori termine noto) / (divisori coefficiente direttivo).",
        problem_tex: "2x^3 - 3x^2 - 3x + 2 = 0",
        solution_tex: "x_1 = -1, \\; x_2 = \\frac{1}{2}, \\; x_3 = 2",
        steps_tex: []
    },
    {
        id: "pre_poli_007",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Regola di Ruffini iterata",
        theory_snippet: "Nelle equazioni di 4° grado, applica Ruffini due volte per scendere a un'equazione di 2° grado.",
        problem_tex: "x^4 - 2x^3 - 7x^2 + 8x + 12 = 0",
        solution_tex: "x = -2, \\; x = -1, \\; x = 2, \\; x = 3",
        steps_tex: []
    },

    // --- SOSTITUZIONE E BIQUADRATICHE ---
    {
        id: "pre_poli_008",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Equazione Biquadratica",
        theory_snippet: "Usa la sostituzione t = x^2. Scarta immediatamente eventuali valori negativi di t (in campo reale).",
        problem_tex: "x^4 - 13x^2 + 36 = 0",
        solution_tex: "x = \\pm 2, \\; x = \\pm 3",
        steps_tex: []
    },
    {
        id: "pre_poli_009",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Equazione Biquadratica",
        theory_snippet: "Attenzione alle soluzioni complesse. Se un fattore è (x^2 + k) con k > 0, esso non genera radici reali.",
        problem_tex: "x^4 - 5x^2 - 36 = 0",
        solution_tex: "x = \\pm 3 \\quad \\text{(Le radici da } x^2=-4 \\text{ non sono in } \\mathbb{R})",
        steps_tex: []
    },
    {
        id: "pre_poli_010",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Equazione Trinomia",
        theory_snippet: "La sostituzione funziona per qualsiasi proporzione 2:1 tra gli esponenti. Qui usa t = x^3.",
        problem_tex: "x^6 - 7x^3 - 8 = 0",
        solution_tex: "x_1 = -1, \\; x_2 = 2",
        steps_tex: []
    },

    // --- DISEQUAZIONI POLINOMIALI ---
    {
        id: "pre_poli_011",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Disequazione di 3° grado",
        theory_snippet: "Raccogli totalmente e studia il segno dei fattori. Non dividere per l'incognita per non perdere intervalli di soluzione.",
        problem_tex: "x^3 - 4x \\ge 0",
        solution_tex: "x \\in [-2, 0] \\cup [2, +\\infty)",
        steps_tex: []
    },
    {
        id: "pre_poli_012",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Disequazione Biquadratica",
        theory_snippet: "Scomponi i quadrati perfetti o usa t = x^2. Traccia la griglia dei segni solo quando hai i fattori finali (x - a).",
        problem_tex: "x^4 - 5x^2 + 4 < 0",
        solution_tex: "x \\in (-2, -1) \\cup (1, 2)",
        steps_tex: []
    },
    {
        id: "pre_poli_013",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Disequazione con Radici Multiple",
        theory_snippet: "Se un fattore è elevato a potenza pari (es. (x-1)^2), non cambia il segno della disequazione ma il suo zero va incluso o escluso dal dominio.",
        problem_tex: "x^3 - x^2 - x + 1 > 0",
        solution_tex: "x \\in (-1, 1) \\cup (1, +\\infty)",
        steps_tex: []
    },
    {
        id: "pre_poli_014",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Disequazione (Cubo Perfetto)",
        theory_snippet: "Riconosci i prodotti notevoli per saltare i passaggi. (A \\pm B)^3 mantiene il segno della base.",
        problem_tex: "x^3 - 6x^2 + 12x - 8 < 0",
        solution_tex: "x \\in (-\\infty, 2)",
        steps_tex: []
    },
    {
        id: "pre_poli_015",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Disequazione Mista",
        theory_snippet: "Raccogli parzialmente e studia la positività dei trinomi non ulteriormente scomponibili.",
        problem_tex: "x^4 + 2x^3 - 8x - 16 \\le 0",
        solution_tex: "x \\in [-2, 2]",
        steps_tex: []
    }
];