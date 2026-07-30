"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export function ModalShell({
  children,
  closeHref,
  description,
  title,
}: {
  children: ReactNode;
  closeHref: string;
  description?: string;
  title: string;
}) {
  const router = useRouter();
  const closeRef = useRef<HTMLAnchorElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") router.push(closeHref);
    };
    window.addEventListener("keydown", fecharComEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [closeHref, router]);

  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <Link
        className="modal-backdrop"
        href={closeHref}
        aria-hidden="true"
        tabIndex={-1}
      />
      <section className="modal-card">
        <header className="modal-header">
          <div>
            <span className="section-kicker">Cadastro</span>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <Link
            ref={closeRef}
            className="modal-close"
            href={closeHref}
            aria-label="Fechar janela"
          >
            <X size={19} />
          </Link>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  );
}
