import {describe, expect, it} from 'vitest';

import {normalizeTagName, parseTagBody, parseTagId} from './schemas';

describe('tag schemas', () => {
  it('normalizes tag names consistently', () => {
    expect(normalizeTagName('  Foo   Bar  ')).toEqual({
      name: 'Foo Bar',
      normalizedName: 'foo bar',
    });
  });

  it('rejects empty and too-long tag names', () => {
    expect(() => parseTagBody({name: '   '})).toThrow('Tag name is required');
    expect(() => parseTagBody({name: 'a'.repeat(33)})).toThrow('Tag name must be at most 32 characters');
  });

  it('parses tag ids as positive integers', () => {
    expect(parseTagId('12')).toBe(12);
    expect(() => parseTagId('0')).toThrow('Invalid tag ID');
  });
});
