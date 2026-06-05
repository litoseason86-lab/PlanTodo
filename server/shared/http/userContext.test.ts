import {describe, expect, it} from 'vitest';

import {DEFAULT_USER_ID, getUserContext} from './userContext';

describe('user context', () => {
  it('centralizes the local single-user id', () => {
    expect(DEFAULT_USER_ID).toBe(1);
    expect(getUserContext().userId).toBe(DEFAULT_USER_ID);
  });
});
