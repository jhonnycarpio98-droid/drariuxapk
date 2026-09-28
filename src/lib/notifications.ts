import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { NotificationItem } from "@/api/client";

/**
 * Notificaciones en el teléfono.
 *
 * - En Android (nativo) usamos @capacitor/local-notifications: cada evento nuevo
 *   de la casa (nacimiento, muerte, boda, deserción, nombramiento, alerta) se
 *   muestra como notificación local del sistema. No requiere Firebase ni
 *   credenciales externas: se generan en el propio dispositivo al consultar el
 *   feed, de modo que funcionan también con el servidor en LAN/depuración.
 * - En el preview web usamos la Notification API del navegador si el usuario la
 *   autoriza; si no, simplemente no molestandos (el feed sigue visible en la
 *   pestaña "Avisos").
 *
 * Guardamos en almacenamiento los ids ya notificados para no repetir avisos.
 */

const SEEN_KEY = "civitas.notifs.seen";
const MAX_SEEN = 400;

const KIND_EMOJI: Record<string, string> = {
  familia: "👶",
  servidumbre: "🧵",
  gobierno: "👑",
  economia: "🌾",
  militar: "⚔️",
  alerta: "⚠️",
};

async function loadSeen(): Promise<number[]> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key: SEEN_KEY });
      return value ? (JSON.parse(value) as number[]) : [];
    }
    const raw = globalThis.localStorage?.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

async function saveSeen(ids: number[]) {
  const trimmed = ids.slice(-MAX_SEEN);
  try {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: SEEN_KEY, value: JSON.stringify(trimmed) });
    } else {
      globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(trimmed));
    }
  } catch {
    /* mejor esfuerzo */
  }
}

let requested = false;

/** Pide permiso una vez (nativo o web). Seguro llamarlo en cada arranque. */
export async function initPush(): Promise<void> {
  if (requested) return;
  requested = true;
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.requestPermissions();
    } else if ("Notification" in globalThis && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  } catch {
    /* el canal puede no estar disponible; el feed en-app sigue funcionando */
  }
}

function titleFor(n: NotificationItem): string {
  const emoji = KIND_EMOJI[n.kind] || "📣";
  return `${emoji} Civitas`;
}

/**
 * Notifica los ítems aún no vistos y los marca como enviados. Devuelve cuántos
 * avisos se dispararon. Nunca lanza.
 */
export async function notifyNew(items: NotificationItem[]): Promise<number> {
  const seen = new Set(await loadSeen());
  const fresh = items.filter((n) => n.unread && !seen.has(n.id));
  if (fresh.length === 0) return 0;

  for (const n of fresh) {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await LocalNotifications.checkPermissions();
        if (perm.display === "granted") {
          await LocalNotifications.schedule({
            notifications: [
              {
                id: Math.abs(n.id) % 2_000_000_000 || 1,
                title: titleFor(n),
                body: n.text,
                smallIcon: "ic_launcher",
              },
            ],
          });
        }
      } else if (
        "Notification" in globalThis &&
        Notification.permission === "granted"
      ) {
        new Notification(titleFor(n), { body: n.text });
      }
    } catch {
      /* sigue el siguiente */
    }
    seen.add(n.id);
  }
  await saveSeen([...seen]);
  return fresh.length;
}
