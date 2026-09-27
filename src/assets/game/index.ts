/**
 * Civitas — Game Asset Library resolver
 * -------------------------------------
 * Carga de forma diferida/perezosa todos los iconos PNG generados bajo
 * `src/assets/game/**` y expone helpers para que la UI muestre el icono de
 * una entidad por su id (ej. "trigo", "archer", "dairy_cow", "hierro").
 *
 * Los huecos definidos en `manifest.json` que aún no tienen PNG simplemente no
 * aparecen en el mapa: `getGameIcon()` devuelve `undefined` y la UI puede caer
 * a su render textual actual. Así la librería se puede ir poblando poco a poco
 * sin romper nada.
 *
 * Los iconos son PNG con fondo transparente, ~128px, estilo plano.
 */
import manifest from "./manifest.json";

// Todos los assets reales (solo los que existen en disco al compilar).
// Acepta SVG (ligero, vectorial, transparente) y PNG (arte raster futuro).
const modules = import.meta.glob("./*/*.{png,svg}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Mapa id -> url  (id = nombre de archivo sin extensión, p.ej. "trigo")
const byId = new Map<string, string>();
// Mapa "categoria/id" -> url, por si hay ids repetidos entre categorías.
const byQualified = new Map<string, string>();

for (const [path, url] of Object.entries(modules)) {
  const m = path.match(/\.\/([^/]+)\/([^/]+)\.(?:png|svg)$/);
  if (!m) continue;
  const [, category, id] = m;
  byQualified.set(`${category}/${id}`, url);
  // La primera vez gana; si un id se repite, se sigue resolviendo por categoría.
  if (!byId.has(id)) byId.set(id, url);
}

/** Devuelve la URL del icono de una entidad, o `undefined` si aún no existe. */
export function getGameIcon(id: string, category?: string): string | undefined {
  if (category) {
    const q = byQualified.get(`${category}/${id}`);
    if (q) return q;
  }
  return byId.get(id);
}

/** ¿Existe ya un icono generado para esta entidad? */
export function hasGameIcon(id: string, category?: string): boolean {
  return getGameIcon(id, category) !== undefined;
}

/** Componente de helpers para la UI: resuelve icono o devuelve `null`. */
export function gameIconOr(
  id: string,
  category?: string,
  fallback: string | null = null,
): string | null {
  return getGameIcon(id, category) ?? fallback;
}

export const assetManifest = manifest;
export type GameCategory =
  | "biomes"
  | "crops"
  | "livestock"
  | "units"
  | "resources"
  | "consumables"
  | "categories"
  | "ui";
