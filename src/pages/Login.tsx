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
  const [startChoice, setStartChoice] =
    useState<"gobernador" | "administrador" | "vasallo">("administrador");
  const [sex, setSex] = useState<"hombre" | "mujer">("hombre");
  const [infoOpen, setInfoOpen] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    if (mode === "register" && startChoice === "vasallo" && !vassalCode.trim()) {
      setError("Para iniciar como vasallo necesitas un código de vasallaje.");
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
              startChoice,
              sex,
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
      if (code === "sin_tierras" || code === "sin_feudos") {
        setError(
          msg ||
            "No quedó tierra disponible. Prueba iniciar como vasallo con un código, o reintenta.",
        );
      } else if (err instanceof ApiError) {
        setError(
          (msg ||
            (err.status === 401
              ? "Usuario o contraseña incorrectos."
              : "No se pudo conectar con el servidor.")) + ` [HTTP ${err.status}]`
        );
      } else {
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        setError(`Error de red. Revisa la conexión. (${detail})`);
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
            <div className="start-choice">
              <div className="start-choice-title">¿Cómo empiezas?</div>
              {([
                {
                  id: "gobernador" as const,
                  label: "Señor de una región",
                  info:
                    "Recibes una región entera sin reclamar con sus provincias, población NPC " +
                    "y tu feudo capital. Fundarla tendrá un peaje de 100 monedas (por ahora abierto gratis).",
                },
                {
                  id: "administrador" as const,
                  label: "Administrador de un feudo (gratis)",
                  info:
                    "Entras sin tierras propias: gestionas un feudo activo de otra casa " +
                    "(sembrar, cosechar, pastoreo, compost, jornaleros). No eres su dueño: retienes " +
                    "la cosecha menos el impuesto que fije el señor de la provincia.",
                },
                {
                  id: "vasallo" as const,
                  label: "Vasallo (con código de referido)",
                  info:
                    "Te integras a la provincia de otro señor con un código de vasallaje que él te haya dado.",
                },
              ]).map((opt) => (
                <div className={"choice" + (startChoice === opt.id ? " selected" : "")} key={opt.id}>
                  <label className="choice-main">
                    <input
                      type="radio"
                      name="start_choice"
                      checked={startChoice === opt.id}
                      onChange={() => setStartChoice(opt.id)}
                    />
                    <span>{opt.label}</span>
                  </label>
                  <button
                    type="button"
                    className="choice-info"
                    aria-label={`Qué significa ${opt.label}`}
                    onClick={() => setInfoOpen(infoOpen === opt.id ? null : opt.id)}
                  >
                    ?
                  </button>
                  {infoOpen === opt.id && <p className="choice-detail">{opt.info}</p>}
                </div>
              ))}

              {startChoice === "vasallo" && (
                <label className="field">
                  <span>Código de vasallaje</span>
                  <input
                    value={vassalCode}
                    onChange={(e) => setVassalCode(e.target.value.toUpperCase())}
                    placeholder="obligatorio: te lo dio el señor"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </label>
              )}

              <div className="field">
                <span>Sexo del señor/a de la casa</span>
                <div className="seg" role="radiogroup" aria-label="sexo del cabeza">
                  <button
                    type="button"
                    className={"seg-btn" + (sex === "hombre" ? " selected" : "")}
                    onClick={() => setSex("hombre")}
                  >
                    Hombre
                  </button>
                  <button
                    type="button"
                    className={"seg-btn" + (sex === "mujer" ? " selected" : "")}
                    onClick={() => setSex("mujer")}
                  >
                    Mujer
                  </button>
                </div>
                <p className="muted small" style={{ marginTop: 4 }}>
                  Determina el sexo de tu personaje; su cónyuge será del sexo
                  opuesto para que la línea familiar continúe.
                </p>
              </div>
            </div>
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
