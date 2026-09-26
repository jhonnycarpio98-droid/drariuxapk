import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import logoUrl from "@/assets/logo.svg";
import { api, ApiError, setToken } from "@/api/client";
import { ensureWallet } from "@/lib/wallet";

/**
 * Pantalla de acceso de la app (token based).
 *
 * El motor emite un token en /api/auth/{login,register}/; lo guardamos y a
 * partir de ahí el cliente manda "Authorization: Token …" en cada petición.
 * Así funciona desde el WebView de Capacitor, donde las cookies de sesión del
 * dominio remoto no viajan.
 */
export default function Login({ onAuthed }: { onAuthed: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [house, setHouse] = useState("");
  const [vassalCode, setVassalCode] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noLand, setNoLand] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "register" && password2 !== password) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (mode === "register" && !house.trim()) {
      setError("Indica el nombre de tu dinastía (una sola palabra).");
      return;
    }
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.auth.login(username, password)
          : await api.auth.register(username, password, {
              email,
              house: house.trim(),
              vassalCode: vassalCode.trim() || undefined,
            });
      setToken(res.token);
      queryClient.clear(); // descartar cualquier estado de la sesión anterior
      // Wallet intrínseca: al crear la partida (o si aún no tiene dirección)
      // generamos el par con viem y registramos la dirección pública.
      try {
        await ensureWallet();
      } catch {
        /* no bloquea el acceso: se reintenta al abrir Wallet */
      }
      onAuthed();
      navigate("/", { replace: true });
    } catch (err) {
      const payload =
        err instanceof ApiError ? (err.payload as Record<string, unknown>) : null;
      const code = payload?.error as string | undefined;
      const msg = (payload?.msg as string) || null;
      if (code === "sin_tierras") {
        setNoLand(true);
        setError(
          msg ||
            "No quedan regiones libres. Pega un código de vasallaje para entrar como vasallo.",
        );
      } else if (err instanceof ApiError) {
        setError(
          msg ||
            (err.status === 401
              ? "Usuario o contraseña incorrectos."
              : "No se pudo conectar con el servidor."),
        );
      } else {
        setError("Error de red. Revisa la conexión.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card card">
        <div className="login-brand">
          <img src={logoUrl} alt="Civitas" />
          <h1>Civitas</h1>
        </div>

        <div className="subtabs" role="tablist">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={submit} autoComplete="off">
          <label className="field">
            <span>Usuario</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="p. ej. santiux"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>

          {mode === "register" && (
            <label className="field">
              <span>Correo (opcional)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
              />
            </label>
          )}

          {mode === "register" && (
            <label className="field">
              <span>Nombre de dinastía</span>
              <input
                value={house}
                onChange={(e) => setHouse(e.target.value)}
                placeholder="p. ej. Valderas (una sola palabra)"
                autoCapitalize="characters"
                spellCheck={false}
                required
              />
            </label>
          )}

          {mode === "register" && (
            <label className="field">
              <span>Código de vasallaje (opcional)</span>
              <input
                value={vassalCode}
                onChange={(e) => setVassalCode(e.target.value.toUpperCase())}
                placeholder={noLand ? "obligatorio: no quedan regiones libres" : "solo si te invitaron"}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
          )}

          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 8 caracteres"
              required
            />
          </label>

          {mode === "register" && (
            <label className="field">
              <span>Repite la contraseña</span>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="…"
              />
            </label>
          )}

          {error && <div className="state error">{error}</div>}

          <div className="actions" style={{ marginTop: 12 }}>
            <button type="submit" className="btn" disabled={busy} style={{ flex: 1 }}>
              {busy
                ? "Conectando…"
                : mode === "login"
                  ? "Entrar"
                  : "Registrarme"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
