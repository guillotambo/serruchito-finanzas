import type { Cache } from "swr";

const STORAGE_KEY = "serruchito:swr-cache";

// Cache de SWR persistido en localStorage: si /api/portfolio (u otro
// endpoint) falla en una carga fresca de la página, SWR igual tiene el
// último dato bueno para mostrar (con `error` seteado al lado) en vez de no
// tener nada -> la pantalla no queda en blanco solo por un 500 transitorio.
// Patrón recomendado por la propia documentación de SWR ("Cache Provider").
export function localStorageProvider(): Cache {
  if (typeof window === "undefined") return new Map();

  let entries: [string, unknown][] = [];
  try {
    entries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    entries = [];
  }
  const map = new Map(entries) as Cache;

  window.addEventListener("beforeunload", () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...(map as unknown as Map<string, unknown>).entries()]));
    } catch {
      // localStorage lleno o inaccesible -> se pierde el cache persistido, no rompe la app
    }
  });

  return map;
}
