import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCompactRelativeTime } from "@serruchito/core";

const NOW = new Date("2026-03-10T12:00:00.000Z").getTime();

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

test("formatCompactRelativeTime: sin fecha o fecha inválida da '—'", () => {
  assert.equal(formatCompactRelativeTime(null, NOW), "—");
  assert.equal(formatCompactRelativeTime("no-es-una-fecha", NOW), "—");
});

test("formatCompactRelativeTime: menos de un minuto es '' (solo el punto de color)", () => {
  assert.equal(formatCompactRelativeTime(new Date(NOW).toISOString(), NOW), "");
  assert.equal(formatCompactRelativeTime(minutesAgo(59 / 60), NOW), "");
  // Reloj adelantado (fecha "futura" por un instante): tampoco es "hace instantes".
  assert.equal(formatCompactRelativeTime(new Date(NOW + 5_000).toISOString(), NOW), "");
});

test("formatCompactRelativeTime: minutos", () => {
  assert.equal(formatCompactRelativeTime(minutesAgo(1), NOW), "1m");
  assert.equal(formatCompactRelativeTime(minutesAgo(27), NOW), "27m");
  assert.equal(formatCompactRelativeTime(minutesAgo(59), NOW), "59m");
});

test("formatCompactRelativeTime: horas", () => {
  assert.equal(formatCompactRelativeTime(minutesAgo(60), NOW), "1h");
  assert.equal(formatCompactRelativeTime(minutesAgo(60 * 23), NOW), "23h");
});

test("formatCompactRelativeTime: días", () => {
  assert.equal(formatCompactRelativeTime(minutesAgo(60 * 24), NOW), "1d");
  assert.equal(formatCompactRelativeTime(minutesAgo(60 * 24 * 3), NOW), "3d");
});
