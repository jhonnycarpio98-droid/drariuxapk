# Civitas — Librería de Assets del Juego

Estudio + librería de iconos ligeros (PNG con **fondo transparente**, ~128px,
estilo plano y paleta consistente) para las entidades del mundo de Civitas.

## Por qué

Hoy el cliente (`civitas-app`) muestra **solo texto** para recursos, cultivos,
ganado, unidades, etc. El único asset gráfico existente era el logo
(`src/assets/logo.svg`). Esta librería añade iconografía sin romper nada: los
huecos sin imagen simplemente siguen renderizando como texto.

## Censo de entidades (fuente de verdad = datos del motor)

| Categoría | Origen (motor) | Slots |
|-----------|----------------|-------|
| `biomes` | `world/agriculture/crop_data.py::BIOME_COMPATIBILITY` | 10 |
| `crops` | `crop_data.py::CROP_DATA` | 48 |
| `livestock` | `world/livestock_data.py::ANIMAL_DATA` (pares macho/hembra colapsados a ~20 animales base) | 20 |
| `units` | `world/military_data.py::MILITARY_UNITS` (tipos de tropa) | 6 |
| `resources` | materias primas minerales/base (madera, piedra, hierro, plata, oro, cobre, arcilla, sal, aceite) | 9 |
| `consumables` | `world/consumables_data.py::CONSUMABLES` | 20 |
| `categories` | `world/resource_categories.py::RESOURCE_CATEGORIES` | 14 |
| `ui` | iconos de interfaz (DRX, corona, casa noble, población, comida, mercado, ejército, familia) | 8 |
| **Total** | | **135** |

> Las **categorías** y **clases de unidades** son suficientes como iconografía de
> representatividad: no hace falta un PNG distinto para cada uno de los 48
> cultivos el día uno. El `manifest.json` define los 135 slots para poder
> poblarlos de forma incremental.

## Estructura

```
src/assets/game/
├── manifest.json     # contrato: id, nombre, categoría, archivo, status (pending|ready)
├── index.ts          # resolver Vite: getGameIcon(id, category?) / hasGameIcon / gameIconOr
├── README.md         # este documento
├── biomes/*.png
├── crops/*.png
├── livestock/*.png
├── units/*.png
├── resources/*.png
├── consumables/*.png
├── categories/*.png
└── ui/*.png
```

Convención de nombres: `<id>.png`, donde `id` es la clave exacta del motor
(p. ej. `trigo.png`, `archer.png`, `dairy_cow.png`, `hierro.png`).

## Formato / estilo

- PNG **32 bits con alfa** (fondo transparente).
- Lienzo 128×128, recortado y centrado con ~8% de margen.
- Estilo: icono de juego plano, contorno suave, una paleta compartida
  (naranja Drariux #FF7A18 + cian #00E5FF como acentos).
- Peso objetivo: **< 6 KB** por icono (cuantización de paleta a ≤ 256 colores).

## Cómo se usa en la UI

```ts
import { getGameIcon } from "@/assets/game";

const url = getGameIcon("trigo", "crops"); // undefined si aún no existe
// <img src={url} alt="Trigo" />  ... o fallback textual si url es undefined
```

## Pipeline de generación

`tools/gen_game_assets.py` (en la raíz del repo del motor) produce las imágenes
por lotes (sheets por categoría), las trocea, quita el fondo a transparente,
redimensiona a 128px, cuantiza la paleta y actualiza `status` en
`manifest.json`. Reejecutable e idempotente.
