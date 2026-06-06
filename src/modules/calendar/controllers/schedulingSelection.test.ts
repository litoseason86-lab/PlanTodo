import {expect, it} from 'vitest';

import {clearSelection, selectAllVisible, toggleTaskSelection} from './schedulingSelection';

it('toggles one task id without mutating the previous set', () => {
  const current = new Set([1]);
  const next = toggleTaskSelection(current, 2);
  expect([...current]).toEqual([1]);
  expect([...next].sort()).toEqual([1, 2]);
  expect([...toggleTaskSelection(next, 1)]).toEqual([2]);
});

it('selects only unique visible task ids', () => {
  expect([...selectAllVisible([1, 2, 2, 3])]).toEqual([1, 2, 3]);
});

it('returns an empty set when clearing selection', () => {
  expect(clearSelection().size).toBe(0);
});
