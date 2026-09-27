import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { getGameIcon } from "@/assets/game";

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

/**
 * Icono de una entidad del juego (recurso, cultivo, unidad, bioma…) tomado de la
 * librería `src/assets/game`. Resuelve por `id` (y opcionalmente `category`);
 * normaliza a minúsculas por si el motor manda el nombre capitalizado. Si aún no
 * existe el asset devuelve `null`, así la UI conserva su render textual sin romper.
 */
export function GameIcon({
  id,
  category,
  size = 22,
  className,
}: {
  id: string | null | undefined;
  category?: string;
  size?: number;
  className?: string;
}) {
  if (!id) return null;
  const url = getGameIcon(id, category) ?? getGameIcon(id.toLowerCase(), category);
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={"gicon" + (className ? ` ${className}` : "")}
      style={{ width: size, height: size }}
    />
  );
}
