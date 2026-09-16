"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { BROKER_LABELS } from "@serruchito/core";
import type { ImportResponse } from "@serruchito/core";

/**
 * Carga masiva de movimientos desde una planilla (CSV). Dos pasos: al elegir
 * el archivo se pide una vista previa (dryRun) y recién con "Importar" se
 * graba. Si hay filas con errores no se importa nada: se listan para
 * corregirlas en la planilla y volver a subirla.
 */
export function ImportTransactionsCard() {
  const { mutate } = useSWRConfig();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inserted, setInserted] = useState<number | null>(null);

  async function send(text: string, dryRun: boolean): Promise<ImportResponse> {
    const res = await fetch("/api/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text, dryRun }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "No se pudo procesar la planilla.");
    return body as ImportResponse;
  }

  async function handleFile(file: File | undefined) {
    setError(null);
    setInserted(null);
    setPreview(null);
    setCsv(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setError("Ese archivo es de Excel. Guardalo como CSV (Archivo → Guardar como → CSV) y subí ese.");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      setCsv(text);
      setPreview(await send(text, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!csv) return;
    setError(null);
    setBusy(true);
    try {
      const result = await send(csv, false);
      if (result.errors.length > 0) {
        setPreview(result);
        return;
      }
      await Promise.all(["/api/transactions", "/api/portfolio", "/api/snapshots"].map((key) => mutate(key)));
      setInserted(result.inserted);
      setPreview(null);
      setCsv(null);
      setFileName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setBusy(false);
    }
  }

  const canImport = !busy && preview != null && preview.errors.length === 0 && preview.rows.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <ol className="text-sm list-decimal pl-5 flex flex-col gap-1" style={{ color: "var(--text-secondary)" }}>
        <li>
          Descargá la{" "}
          <a href="/plantilla-movimientos.csv" download className="underline" style={{ color: "var(--accent)" }}>
            plantilla
          </a>{" "}
          y abrila con Excel o Google Sheets.
        </li>
        <li>Borrá las filas de ejemplo y cargá una fila por compra o venta.</li>
        <li>Guardala como CSV y subila acá.</li>
      </ol>

      <label
        className="self-start rounded-md border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors hover:opacity-90"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface-page)" }}
      >
        {fileName ?? "Elegir archivo…"}
        <input
          type="file"
          accept=".csv,text/csv,.xls,.xlsx"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      {busy && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Procesando…
        </p>
      )}

      {preview && (
        <div className="flex flex-col gap-2">
          <p className="text-sm" style={{ color: "var(--text-primary)" }}>
            {`${preview.rows.length} movimiento${preview.rows.length === 1 ? "" : "s"} listo${preview.rows.length === 1 ? "" : "s"} para importar`}
            {preview.errors.length > 0 && ` · ${preview.errors.length} fila${preview.errors.length === 1 ? "" : "s"} con errores`}
          </p>

          {preview.errors.length > 0 && (
            <ul className="text-sm flex flex-col gap-1" style={{ color: "var(--status-critical)" }}>
              {preview.errors.map((e) => (
                <li key={e.line}>{`Fila ${e.line}: ${e.message}`}</li>
              ))}
            </ul>
          )}

          {preview.rows.length > 0 && (
            <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm tabular-nums">
                <thead style={{ color: "var(--text-muted)" }}>
                  <tr className="text-left">
                    <th className="px-2 py-1 font-medium">Fecha</th>
                    <th className="px-2 py-1 font-medium">Broker</th>
                    <th className="px-2 py-1 font-medium">Op.</th>
                    <th className="px-2 py-1 font-medium">Ticker</th>
                    <th className="px-2 py-1 font-medium text-right">Cantidad</th>
                    <th className="px-2 py-1 font-medium text-right">Precio</th>
                  </tr>
                </thead>
                <tbody style={{ color: "var(--text-primary)" }}>
                  {preview.rows.map((r) => (
                    <tr key={r.line} className="border-t" style={{ borderColor: "var(--gridline)" }}>
                      <td className="px-2 py-1">{r.date.split("-").reverse().join("/")}</td>
                      <td className="px-2 py-1">{BROKER_LABELS[r.broker]}</td>
                      <td className="px-2 py-1">{r.side === "buy" ? "Compra" : "Venta"}</td>
                      <td className="px-2 py-1">{r.ticker}</td>
                      <td className="px-2 py-1 text-right">{r.quantity.toLocaleString("es-AR")}</td>
                      <td className="px-2 py-1 text-right">{`${r.currency} ${r.price.toLocaleString("es-AR")}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Corregí esas filas en la planilla y volvé a subirla. No se importa nada hasta que no haya errores.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="self-start rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 transition-colors hover:opacity-90"
              style={{ background: "var(--accent)", color: "var(--accent-on)" }}
            >
              Importar
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--status-critical)" }}>
          {error}
        </p>
      )}
      {inserted != null && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {`Listo: se importaron ${inserted} movimiento${inserted === 1 ? "" : "s"}. Ya los ves en Cartera y Movimientos.`}
        </p>
      )}
    </div>
  );
}
