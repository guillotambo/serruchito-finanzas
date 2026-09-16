"use client";

import { SWRConfig } from "swr";
import { CurrencyProvider } from "@/lib/currency-context";
import { PrivacyProvider } from "@/lib/privacy-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import { localStorageProvider } from "@/lib/swr-persisted-cache";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
      <CurrencyProvider>
        <PrivacyProvider>
          <SidebarProvider>{children}</SidebarProvider>
        </PrivacyProvider>
      </CurrencyProvider>
    </SWRConfig>
  );
}
