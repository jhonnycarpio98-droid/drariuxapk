import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

/** Renderiza el estado canónico (carga / error / vacío / datos) de una consulta. */
export function QueryBoundary<T>({
  q,
  children,
}: {
  q: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (q.isPending) return <div className="state">Cargando…</div>;
  if (q.isError) {
    return (
      <div className="state error">
        No se pudo cargar el estado del motor. ¿Sin sesión o VPS inaccesible?
      </div>
    );
  }
  return <>{children(q.data as T)}</>;
}

export function money(n: number | undefined | null, symbol = "DRX"): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toLocaleString("es", { maximumFractionDigits: 4 })} ${symbol}`;
}
