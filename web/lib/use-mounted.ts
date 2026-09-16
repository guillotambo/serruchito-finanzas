"use client";

import { useSyncExternalStore } from "react";

/**
 * `false` durante el render del servidor y el de hidratación, `true` recién
 * después.
 *
 * El servidor siempre renderiza el estado "todavía sin datos" (los hooks de
 * SWR no tienen nada en SSR), pero el cliente puede tener el cache persistido
 * en localStorage (ver lib/swr-persisted-cache.ts) y pintar la pantalla
 * completa en el primer render -> mismatch de hidratación, React descarta y
 * reconstruye el árbol, y los clicks que caen justo en esa ventana (los
 * filtros, el switch de efectivo) se pierden. Este flag fuerza que el primer
 * render del cliente sea igual al del servidor.
 *
 * Usa useSyncExternalStore y no useState + useEffect: hace exactamente lo
 * mismo pero sin llamar setState dentro de un efecto, que dispara un render en
 * cascada (regla react-hooks/set-state-in-effect).
 */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
