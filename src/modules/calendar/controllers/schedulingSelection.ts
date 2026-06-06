export function toggleTaskSelection(current: Set<number>, taskId: number): Set<number> {
  const next = new Set(current);
  if (next.has(taskId)) {
    next.delete(taskId);
  } else {
    next.add(taskId);
  }
  return next;
}

export function selectAllVisible(taskIds: number[]): Set<number> {
  return new Set(taskIds);
}

export function clearSelection(): Set<number> {
  return new Set();
}
