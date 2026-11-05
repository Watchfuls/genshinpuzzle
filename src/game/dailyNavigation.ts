export function nextDailyPuzzleDate(
  selectedDate: string,
  today: string,
  assignedNextDate?: string | null,
): string | null {
  if (selectedDate >= today) return null;

  if (assignedNextDate && assignedNextDate > selectedDate && assignedNextDate <= today) {
    return assignedNextDate;
  }

  // A missing assignment must not prevent navigating back toward today.
  const nextDay = new Date(selectedDate + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.toISOString().slice(0, 10);
}
