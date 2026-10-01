export const problemBank = [
    {
        id: "pre_irraz_001",
        course: "Pre-Analisi",
        module: "Equazioni e Disequazioni",
        topic: "Irrazionali",
        theory_snippet: "Per risolvere \\(\\sqrt{A(x)} = B(x)\\), imposta il sistema:\n1) \\(B(x) \\ge 0\\) (concordanza del segno)\n2) \\(A(x) = [B(x)]^2\\)\nNon serve porre \\(A(x) \\ge 0\\).",
        problem_tex: "\\sqrt{2x + 3} = x",
        solution_tex: "x = 3",
        steps_tex: [
            "\\text{Imposto il sistema: } x \\ge 0 \\text{ e } 2x + 3 = x^2",
            "\\text{Riordino l'equazione: } x^2 - 2x - 3 = 0",
            "\\text{Le radici sono } x = 3 \\text{ e } x = -1",
            "\\text{Scarto } x = -1 \\text{ perché non rispetta } x \\ge 0."
        ]
    },
    {
        id: "geo_diag_001",
        course: "Geometria",
        module: "Geometria Euclidea",
        topic: "Diagonalizzazione",
        theory_snippet: "Trova il polinomio caratteristico calcolando \\(\\det(A - \\lambda I) = 0\\). Le radici sono gli autovalori.",
        problem_tex: "\\text{Trovare gli autovalori di } A = \\begin{pmatrix} 2 & 1 \\\\ 1 & 2 \\end{pmatrix}",
        solution_tex: "\\lambda_1 = 3, \\lambda_2 = 1",
        steps_tex: [
            "\\text{Matrice } A - \\lambda I = \\begin{pmatrix} 2-\\lambda & 1 \\\\ 1 & 2-\\lambda \\end{pmatrix}",
            "\\text{Determinante: } (2-\\lambda)^2 - 1 = \\lambda^2 - 4\\lambda + 3 = 0",
            "\\text{Le radici sono } \\lambda = 3 \\text{ e } \\lambda = 1."
        ]
    }
];