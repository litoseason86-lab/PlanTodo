export const MIN_COUNTED_FOCUS_DURATION_SECONDS = 5 * 60;

interface FocusSessionDuration {
  status: string;
  durationSeconds?: number;
}

export function focusSessionDurationSeconds(session: Pick<FocusSessionDuration, 'durationSeconds'>): number {
  return session.durationSeconds ?? 0;
}

export function focusSessionDurationMinutes(session: Pick<FocusSessionDuration, 'durationSeconds'>): number {
  return Math.round(focusSessionDurationSeconds(session) / 60);
}

export function isCountedFocusSession(session: FocusSessionDuration): boolean {
  return session.status === 'COMPLETED' && focusSessionDurationSeconds(session) >= MIN_COUNTED_FOCUS_DURATION_SECONDS;
}

export function sumCountedFocusSessionSeconds<T extends FocusSessionDuration>(sessions: T[]): number {
  return sessions
    .filter(isCountedFocusSession)
    .reduce((sum, session) => sum + focusSessionDurationSeconds(session), 0);
}
