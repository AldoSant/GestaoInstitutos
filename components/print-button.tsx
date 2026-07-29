"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Imprimir ou salvar PDF" }: { label?: string }) {
  return (
    <button className="button primary" type="button" onClick={() => window.print()}>
      <Printer size={16} /> {label}
    </button>
  );
}
