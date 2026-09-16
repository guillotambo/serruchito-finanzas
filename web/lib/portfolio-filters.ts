"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_PORTFOLIO_FILTERS,
  describePortfolioFilters,
  hasActivePortfolioFilters,
  parseBrokerFilter,
} from "@serruchito/core";
import type { Broker, PortfolioFilterChip, PortfolioFilters } from "@serruchito/core";

/**
 * Filtro de cartera (broker + incluir efectivo) compartido entre Inicio y
 * Cartera: antes cada página tenía su propia copia de esta lógica (y Cartera
 * ni siquiera la tenía). Estado en la URL, no en un store -> se comparte
 * entre pestañas/deep-links y sobrevive a un refresh, igual que "vista" en
 * Cartera o los filtros de Movimientos (ver ActivityFilterBar).
 *
 * `includeCash` viaja en la URL como `cash=on` (ausente = excluido, el
 * default). Antes el default era el inverso ("cash=off" para excluir); un
 * link viejo con `?cash=off` simplemente cae en el nuevo default (false), no
 * rompe.
 */
export function usePortfolioFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: PortfolioFilters = useMemo(
    () => ({
      broker: parseBrokerFilter(searchParams.get("broker")),
      includeCash: searchParams.get("cash") === "on",
    }),
    [searchParams]
  );

  const replace = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      mutate(params);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const setBroker = useCallback(
    (value: "all" | Broker) => {
      replace((params) => {
        if (value === DEFAULT_PORTFOLIO_FILTERS.broker) params.delete("broker");
        else params.set("broker", value);
      });
    },
    [replace]
  );

  const setIncludeCash = useCallback(
    (value: boolean) => {
      replace((params) => {
        if (value === DEFAULT_PORTFOLIO_FILTERS.includeCash) params.delete("cash");
        else params.set("cash", "on");
      });
    },
    [replace]
  );

  const removeChip = useCallback(
    (key: PortfolioFilterChip["key"]) => {
      if (key === "broker") setBroker(DEFAULT_PORTFOLIO_FILTERS.broker);
      else setIncludeCash(DEFAULT_PORTFOLIO_FILTERS.includeCash);
    },
    [setBroker, setIncludeCash]
  );

  const clear = useCallback(() => {
    replace((params) => {
      params.delete("broker");
      params.delete("cash");
    });
  }, [replace]);

  const chips = useMemo(() => describePortfolioFilters(filters), [filters]);
  const hasActive = hasActivePortfolioFilters(filters);

  return { filters, setBroker, setIncludeCash, removeChip, clear, chips, hasActive };
}
