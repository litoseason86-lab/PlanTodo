export interface CategoryDurationChartRow {
  name: string;
  minutes: number;
}

export function buildCategoryDurationChart(
  categoryDuration: Record<string, number>,
): CategoryDurationChartRow[] {
  return Object.entries(categoryDuration)
    .map(([name, seconds]) => ({
      name,
      minutes: Math.round(seconds / 60),
    }))
    .sort((left, right) => right.minutes - left.minutes);
}

