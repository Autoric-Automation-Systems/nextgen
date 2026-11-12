/** Datas de domínio (`@db.Date`) vêm em UTC; formatar em UTC evita 1 dia a menos no Brasil. */
export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
    value,
  );
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
