import { TrendingDown, TrendingUp } from "lucide-react";

export function Arrow({ positive }: { positive: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  return <Icon aria-hidden className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />;
}
