"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ProcessingAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(interval);
  }, [active, router]);

  if (!active) return null;
  return (
    <span className="auto-refresh-status" role="status" aria-live="polite">
      Atualização automática a cada 5 segundos
    </span>
  );
}
