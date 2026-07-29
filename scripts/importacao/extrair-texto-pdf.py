from __future__ import annotations

import sys

import pdfplumber


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Uso: extrair-texto-pdf.py <documento.pdf>")
    sys.stdout.reconfigure(encoding="utf-8")

    paginas: list[str] = []
    with pdfplumber.open(sys.argv[1]) as documento:
        for pagina in documento.pages:
            paginas.append(
                pagina.extract_text(
                    layout=True,
                    x_tolerance=2,
                    y_tolerance=2,
                )
                or ""
            )
    sys.stdout.write("\f".join(paginas))


if __name__ == "__main__":
    main()
