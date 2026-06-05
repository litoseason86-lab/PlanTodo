import {useMemo} from 'react';

import type {TaskExecutionSession} from '../../../../shared/domain/entities';

export function formatFocusElapsed(elapsedSeconds: number): string {
  const hours = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(elapsedSeconds % 60).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
}

export function calculateFocusRingOffset(elapsedSeconds: number, circumference = 653): number {
  const progress = Math.min(1, (elapsedSeconds % 3600) / 3600);
  return circumference - circumference * progress;
}

export function calculateEffectiveFocusSeconds(session: TaskExecutionSession, nowMs = Date.now()): number {
  const endMs = session.status === 'PAUSED' && session.pausedAt ? new Date(session.pausedAt).getTime() : nowMs;
  const elapsedSeconds = Math.max(0, Math.round((endMs - new Date(session.startedAt).getTime()) / 1000));
  return Math.max(0, elapsedSeconds - (session.accumulatedPauseSeconds ?? 0));
}

export function useFocusController(focusTimeElapsed: number) {
  return useMemo(
    () => ({
      formattedElapsed: formatFocusElapsed(focusTimeElapsed),
      progressOffset: calculateFocusRingOffset(focusTimeElapsed),
    }),
    [focusTimeElapsed],
  );
}
