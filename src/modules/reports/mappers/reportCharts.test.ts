import {describe, expect, it} from 'vitest';

import {buildCategoryDurationChart} from './reportCharts';

describe('buildCategoryDurationChart', () => {
  it('returns chart rows sorted by duration descending', () => {
    const rows = buildCategoryDurationChart({学习: 1200, 工作: 3600});

    expect(rows).toEqual([
      {name: '工作', minutes: 60},
      {name: '学习', minutes: 20},
    ]);
  });
});
