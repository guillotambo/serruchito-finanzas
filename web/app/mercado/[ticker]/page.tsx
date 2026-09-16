"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { InstrumentDetail } from "@/components/InstrumentDetail";
import type { AssetType } from "@serruchito/core";

export default function InstrumentDetailPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <InstrumentDetailContent />
    </Suspense>
  );
}

function InstrumentDetailContent() {
  const params = useParams<{ ticker: string }>();
  const searchParams = useSearchParams();
  const assetType = (searchParams.get("asset_type") ?? "cedear") as AssetType;
  const ticker = decodeURIComponent(params.ticker).toUpperCase();

  return <InstrumentDetail ticker={ticker} assetType={assetType} />;
}
