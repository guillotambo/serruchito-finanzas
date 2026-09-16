import { BROKER_LABELS } from "@serruchito/core";
import type { Broker } from "@serruchito/core";
import { PillGroup, type PillOption } from "@/components/ui/PillGroup";

const BROKERS: Broker[] = ["cocos", "balanz", "ibkr", "iol"];

const OPTIONS: PillOption<"all" | Broker>[] = [
  { id: "all", label: "Todos" },
  ...BROKERS.map((broker) => ({ id: broker, label: BROKER_LABELS[broker] })),
];

export function BrokerFilter({
  value,
  onChange,
}: {
  value: "all" | Broker;
  onChange: (value: "all" | Broker) => void;
}) {
  return <PillGroup options={OPTIONS} value={value} onChange={onChange} ariaLabel="Filtrar por broker" />;
}
