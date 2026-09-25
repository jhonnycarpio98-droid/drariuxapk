import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type WalletState } from "@/api/client";
import { QueryBoundary, money } from "@/components/ui";

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

  return (
    <QueryBoundary q={q}>
      {(d) => <WalletView d={d} onAction={(b) => runAction.mutate(b)} busy={runAction.isPending} msg={lastMsg(runAction)} ok={runAction.data?.ok} />}
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
}: {
  d: WalletState;
  onAction: (body: Record<string, unknown>) => void;
  busy: boolean;
  msg?: string;
  ok?: boolean;
}) {
  const [addr, setAddr] = useState("");
  const [amount, setAmount] = useState("");

  const amt = Number(amount);
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
          <span className="muted">Denominación</span>
          <span className="mono">{d.denom} · chain {d.chain_id}</span>
        </div>
        <div className="row">
          <span className="muted">Dirección</span>
          <span className="mono">{d.address ? shorten(d.address) : "sin registrar"}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          La clave privada vive solo cifrada en este dispositivo; el motor jamás
          la ve. {d.symbol} es la moneda nativa de la red drariux.
        </p>
      </div>

      <div className="card">
        <h2>Depósitos y reintegros</h2>
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
            disabled={busy || !Number.isFinite(amt) || amt <= 0}
            onClick={() => onAction({ action: "deposit", amount: amt })}
          >
            Depositar
          </button>
          <button
            className="btn ghost"
            disabled={busy || !Number.isFinite(amt) || amt <= 0}
            onClick={() => onAction({ action: "withdraw", amount: amt })}
          >
            Reintegrar
          </button>
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="addr">Registrar dirección pública (0x…)</label>
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
