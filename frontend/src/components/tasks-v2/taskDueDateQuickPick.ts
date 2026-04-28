/** Local calendar date as YYYY-MM-DD (Django DateField / HTML date input). */
export function toDateOnlyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dueDateToday(now: Date = new Date()): string {
  return toDateOnlyLocal(now);
}

export function dueDateTomorrow(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  return toDateOnlyLocal(d);
}

export function dueDateNextWeek(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 7);
  return toDateOnlyLocal(d);
}
