"use client";

import { Suspense } from "react";
import { useSWRConfig } from "swr";
import { useWatchlist } from "@/lib/hooks";
import { ErrorState } from "@/components/ErrorState";
import { StaleDataNotice } from "@/components/StaleDataNotice";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { TickerSearch } from "@/components/TickerSearch";
import { WatchlistTable } from "@/components/WatchlistTable";

export default function MercadoPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <MercadoContent />
    </Suspense>
  );
}

function MercadoContent() {
  const { data, isLoading, error } = useWatchlist();
  const { mutate } = useSWRConfig();

  if (error && !data) {
    return <ErrorState message={error.message} onRetry={() => mutate("/api/watchlist")} />;
  }
  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <StaleDataNotice message={error.message} onRetry={() => mutate("/api/watchlist")} />}
      <div className="flex flex-col gap-4 border-b pb-6" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Seguimiento</p>
          <h1 className="mt-1 text-2xl font-semibold">Mercado</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Seguí el precio de cualquier ticker, lo tengas o no en cartera.
          </p>
        </div>
        <TickerSearch />
      </div>

      <WatchlistTable rows={data.rows} />
    </div>
  );
}
