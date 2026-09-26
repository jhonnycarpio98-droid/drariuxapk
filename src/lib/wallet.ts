import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import type { Address, Hex } from "viem";
import { api } from "@/api/client";

/**
 * Wallet intrínseca del jugador (lado cliente, viem).
 *
 * La clave privada se GENERA y CIFRA aquí, en el dispositivo; jamás viaja al
 * motor. El servidor solo conoce la dirección pública (se registra con
 * `set_address`). En Android usamos Capacitor Preferences; en el preview web,
 * localStorage. La clave AES del dispositivo protege el secreto en reposo
 * (ofuscación resistente a leer el almacenamiento en claro).
 */

const PRIV_KEY = "civitas.wallet.priv"; // clave privada cifrada: {iv, ct} en b64
const DEV_KEY = "civitas.wallet.dk"; // clave simétrica del dispositivo (b64)

// ---------------------------------------------------------------------------
// Almacenamiento (Preferences en nativo, localStorage en web)
// ---------------------------------------------------------------------------
async function getItem(key: string): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Preferences.get({ key });
      return value;
    }
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value });
    } else {
      globalThis.localStorage?.setItem(key, value);
    }
  } catch {
    /* almacenamiento no disponible */
  }
}

// ---------------------------------------------------------------------------
// Cifrado AES-GCM con la clave del dispositivo
// ---------------------------------------------------------------------------
function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deviceKey(): Promise<CryptoKey> {
  let raw = await getItem(DEV_KEY);
  if (!raw) {
    raw = toB64(crypto.getRandomValues(new Uint8Array(32)).buffer);
    await setItem(DEV_KEY, raw);
  }
  return crypto.subtle.importKey("raw", fromB64(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptPriv(pk: string): Promise<string> {
  const key = await deviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(pk),
  );
  return JSON.stringify({ iv: toB64(iv.buffer), ct: toB64(ct) });
}

async function decryptPriv(blob: string): Promise<string> {
  const key = await deviceKey();
  const { iv, ct } = JSON.parse(blob) as { iv: string; ct: string };
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) },
    key,
    fromB64(ct),
  );
  return new TextDecoder().decode(pt);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/** Devuelve la dirección local, generando y cifrando una clave nueva si no hay. */
export async function getOrCreateAddress(): Promise<Address> {
  const stored = await getItem(PRIV_KEY);
  if (stored) {
    try {
      const pk = (await decryptPriv(stored)) as Hex;
      return privateKeyToAccount(pk).address;
    } catch {
      /* blob corrupto: regeneramos abajo */
    }
  }
  const pk = generatePrivateKey();
  await setItem(PRIV_KEY, await encryptPriv(pk));
  return privateKeyToAccount(pk).address;
}

/**
 * Asegura que el jugador tenga dirección registrada en el motor.
 *
 * Idempotente y seguro entre dispositivos: SOLO registra una dirección nueva
 * cuando el servidor aún no tiene ninguna (así no huérfana fondos de un
 * dispositivo previo). Devuelve la dirección en uso o null si no se pudo leer.
 */
export async function ensureWallet(): Promise<Address | null> {
  let serverAddress: string | null = null;
  try {
    serverAddress = (await api.wallet()).address;
  } catch {
    return null;
  }
  if (serverAddress) return serverAddress as Address;
  const address = await getOrCreateAddress();
  try {
    await api.walletAction({ action: "set_address", address });
  } catch {
    /* sin sesión todavía o fallo de red: reintentará en el próximo arranque */
  }
  return address;
}
