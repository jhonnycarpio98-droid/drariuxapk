import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type WalletState, type FundQuote } from "@/api/client";
import { QueryBoundary, money } from "@/components/ui";
import { ensureWallet } from "@/lib/wallet";

// Deep-link para comprar ATOM desde Binance (paso 1 del bridge IBC). Se abre en el
// navegador/wallet del dispositivo; el envío real a la L1 lo hace la app al firmar.
const BINANCE_ATOM_BUY = "https://www.binance.com/en/price/cosmos";

export default function Wallet() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wallet"], queryFn: api.wallet });

  const runAction = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.walletAction(body),
    onSuccess: (r) => {
      if (r.state) qc.setQueryData(["wallet"], r.state);
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  // Recuperación: si el motor aún no tiene dirección (p. ej. porque el primer
  // ensureWallet del arranque coincidió con una partida aún materializándose),
  // reintentamos generarla/vincularla aquí en vez de dejar "generando…" a secas.
  const ensure = useMutation({
    mutationFn: () => ensureWallet(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wallet"] }),
  });

  return (
    <QueryBoundary q={q}>
      {(d) => (
        <WalletView
          d={d}
          onAction={(b) => runAction.mutate(b)}
          busy={runAction.isPending}
          msg={lastMsg(runAction)}
          ok={runAction.data?.ok}
          onEnsure={() => ensure.mutate()}
          ensuring={ensure.isPending}
          ensureFailed={ensure.isError}
        />
      )}
    </QueryBoundary>
  );
}

function lastMsg(m: { data?: { msg?: string }; error?: unknown }): string | undefined {
  if (m.data?.msg) return m.data.msg;
  return undefined;
}

function WalletView({
  d,
  onAction,
  busy,
  msg,
  ok,
  onEnsure,
  ensuring,
  ensureFailed,
}: {
  d: WalletState;
  onAction: (body: Record<string, unknown>) => void;
  busy: boolean;
  msg?: string;
  ok?: boolean;
  onEnsure: () => void;
  ensuring: boolean;
  ensureFailed: boolean;
}) {
  const [addr, setAddr] = useState("");
  const [amount, setAmount] = useState("");
  const [fundAtom, setFundAtom] = useState("");
  const [quote, setQuote] = useState<FundQuote | null>(null);

  // Un único intento automático por montaje si el motor no tiene dirección;
  // si falla, el usuario puede reintentar con el botón.
  const autoTried = useRef(false);
  useEffect(() => {
    if (!d.address && !autoTried.current) {
      autoTried.current = true;
      onEnsure();
    }
  }, [d.address, onEnsure]);

  const amt = Number(amount);
  const atom = Number(fundAtom);

  // Cotiza el fondeo (ATOM -> DRX al precio vivo) sin ejecutarlo.
  async function doQuote() {
    if (!Number.isFinite(atom) || atom <= 0) {
      setQuote(null);
      return;
    }
    const r = await api.walletAction({ action: "quote", atom_amount: atom });
    if (r.ok && r.quote) setQuote(r.quote);
    else setQuote(null);
  }

  // Cotiza al cambiar el importe (debounce ligero) y al montar si ya hay precio.
  const quoteTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    window.clearTimeout(quoteTimer.current);
    quoteTimer.current = window.setTimeout(doQuote, 350);
    return () => window.clearTimeout(quoteTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fundAtom, d.price?.atom_usd]);

  const price = d.price;
  // En MOCK no hay cadena real: fondear/depositar sería acuñar drariux de la
  // nada. El motor ya lo bloquea; aquí deshabilitamos esas acciones y avisamos.
  const isLive = d.mode === "live";
  return (
    <div>
      <div className="card">
        <div className="walletHead">
          <h2 style={{ margin: 0 }}>Monedero</h2>
          <span className={`pill ${d.mode === "live" ? "live" : "mock"}`}>
            {d.mode === "live" ? "cadena real" : "mock"}
          </span>
        </div>

        <div className="balance">
          <div className="k">Saldo en juego</div>
          <div className="v">{money(d.in_game_balance, d.symbol)}</div>
        </div>

        <div className="row">
          <span className="muted">Saldo on-chain</span>
          <span>{money(d.chain_balance, d.symbol)}</span>
        </div>
        <div className="row">
          <span className="muted">Precio ATOM</span>
          <span>
            {price ? `${money(price.atom_usd, "USDT")} / ATOM` : "—"}
            {price && (
              <span className="muted"> · {price.rate_drx_per_usd} DRX/USDT</span>
            )}
          </span>
        </div>
        <div className="row">
          <span className="muted">Denominación</span>
          <span className="mono">{d.denom} · chain {d.chain_id}</span>
        </div>
        <div className="row">
          <span className="muted">Dirección</span>
          {d.address ? (
            <span className="mono">{shorten(d.address)}</span>
          ) : (
            <span className="row">
              <span className="mono">{ensuring ? "generando…" : "sin vincular"}</span>
              <button
                className="btn ghost"
                disabled={ensuring}
                onClick={onEnsure}
                title={ensureFailed ? "No se pudo generar/vincular. Reintentar." : undefined}
              >
                {ensuring ? "Generando…" : "Generar ahora"}
              </button>
            </span>
          )}
        </div>
        {!d.address && ensureFailed && !ensuring && (
          <p className="error" style={{ marginTop: 4 }}>
            No se pudo vincular la dirección con el motor. Pulsa «Generar ahora» para
            reintentarlo.
          </p>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          Tu dirección se creó en este dispositivo con viem al iniciar la partida.
          La clave privada vive solo cifrada aquí; el motor jamás la ve.{" "}
          {d.symbol} es la moneda nativa de la red drariux.
        </p>
      </div>

      <div className="card">
        <h2>Fondear (cripto → {d.symbol})</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Compra/depósita ATOM, conértelo en {d.symbol} al precio vivo y se acredita en tu
          wallet. Cada USDT de ATOM son{" "}
          <b>{price ? price.rate_drx_per_usd : 1000}</b> {d.symbol}.
        </p>
        <div className="field">
          <label htmlFor="atom">Importe (ATOM)</label>
          <input
            id="atom"
            inputMode="decimal"
            placeholder="0.0"
            value={fundAtom}
            onChange={(e) => setFundAtom(e.target.value)}
          />
        </div>
        {quote && (
          <div className="row">
            <span className="muted">Recibirás</span>
            <span className="ok">
              +{money(quote.drx, d.symbol)}{" "}
              <span className="muted">
                (≈ {money(quote.usd_value, "USDT")} @ {money(quote.atom_usd, "USDT")})
              </span>
            </span>
          </div>
        )}
        <div className="actions">
          <a
            className="btn ghost"
            href={BINANCE_ATOM_BUY}
            target="_blank"
            rel="noopener noreferrer"
          >
            Comprar ATOM
          </a>
          <button
            className="btn"
            disabled={busy || !isLive || !Number.isFinite(atom) || atom <= 0}
            onClick={() => onAction({ action: "fund_atom", atom_amount: atom })}
          >
            Fondear
          </button>
        </div>
        {!isLive && (
          <p className="muted" style={{ marginTop: 8 }}>
            El fondeo con cripto está deshabilitado en modo de pruebas (sin cadena
            real): los drariux se obtienen jugando. Se activará al conectar la red
            drariux en producción.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Retirar / convertir y movim. internos</h2>
        <div className="field">
          <label htmlFor="amt">Importe ({d.symbol})</label>
          <input
            id="amt"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="actions">
          <button
            className="btn"
            disabled={busy || !isLive || !Number.isFinite(amt) || amt <= 0}
            onClick={() => onAction({ action: "deposit", amount: amt })}
          >
            Depositar (cadena→juego)
          </button>
          <button
            className="btn ghost"
            disabled={busy || !Number.isFinite(amt) || amt <= 0}
            onClick={() => onAction({ action: "convert", amount: amt })}
            title="Convierte saldo del juego a DRX on-chain (retiro vía DRXConverter)"
          >
            Retirar / convertir
          </button>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="addr">Cambiar dirección vinculada (avanzado)</label>
          <div className="inlineField">
            <input
              id="addr"
              className="mono"
              placeholder="0x…"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
            />
            <button
              className="btn ghost"
              disabled={busy || !addr.trim()}
              onClick={() => onAction({ action: "set_address", address: addr.trim() })}
            >
              Guardar
            </button>
          </div>
        </div>

        {msg && <p className={ok ? "" : "error"}>{msg}</p>}
      </div>

      <div className="card">
        <h2>Historial</h2>
        {(d.log ?? []).length === 0 ? (
          <p className="muted">Sin movimientos registrados.</p>
        ) : (
          d.log.map((e, i) => (
            <div className="row" key={i}>
              <span className={e.kind === "withdraw" ? "error" : "ok"}>
                {e.kind === "withdraw" ? "−" : "+"}
                {money(e.amount, d.symbol)}
              </span>
              <span className="muted mono">{e.hash ? shorten(e.hash) : e.addr || ""}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function shorten(s: string): string {
  if (s.length <= 14) return s;
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}
