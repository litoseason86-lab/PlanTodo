import type {Category, Tag, Task} from '../../../../shared/domain/entities';

export type SchedulingGroupMode = 'none' | 'category' | 'tag' | 'priority';

export interface SchedulingTaskGroup {
  id: string;
  label: string;
  tasks: Task[];
}

const PRIORITY_GROUPS = [
  {id: 'priority:P1', label: 'P1', priority: 'P1'},
  {id: 'priority:P2', label: 'P2', priority: 'P2'},
  {id: 'priority:P3', label: 'P3', priority: 'P3'},
  {id: 'priority:P4', label: 'P4', priority: 'P4'},
  {id: 'priority:none', label: '无优先级', priority: null},
] as const;

export function groupSchedulingTasks(
  tasks: Task[],
  input: {mode: SchedulingGroupMode; categories: Category[]; tags: Tag[]},
): SchedulingTaskGroup[] {
  if (input.mode === 'none') return [{id: 'all', label: '全部', tasks}];
  if (input.mode === 'priority') return groupByPriority(tasks);
  if (input.mode === 'category') return groupByCategory(tasks, input.categories);
  return groupByTag(tasks, input.tags);
}

export function uniqueSelectedTaskIds(selectedTaskIds: Set<number>): number[] {
  return [...selectedTaskIds].sort((left, right) => left - right);
}

function groupByPriority(tasks: Task[]): SchedulingTaskGroup[] {
  return PRIORITY_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    tasks: tasks.filter((task) => task.priority === group.priority),
  })).filter((group) => group.tasks.length > 0);
}

function groupByCategory(tasks: Task[], categories: Category[]): SchedulingTaskGroup[] {
  const known = categories.map((category) => ({
    id: `category:${category.id}`,
    label: category.name,
    tasks: tasks.filter((task) => task.categoryId === category.id),
  })).filter((group) => group.tasks.length > 0);
  const uncategorized = tasks.filter((task) => !categories.some((category) => category.id === task.categoryId));
  return uncategorized.length > 0 ? [...known, {id: 'category:unknown', label: '未分类', tasks: uncategorized}] : known;
}

function groupByTag(tasks: Task[], tags: Tag[]): SchedulingTaskGroup[] {
  const knownTagIds = new Set(tags.map((tag) => tag.id));
  const tagGroups = tags.map((tag) => ({
    id: `tag:${tag.id}`,
    label: tag.name,
    tasks: tasks.filter((task) => task.tagIds.includes(tag.id)),
  })).filter((group) => group.tasks.length > 0);
  const untagged = tasks.filter((task) => task.tagIds.length === 0);
  const unknownTagged = tasks.filter((task) => task.tagIds.some((tagId) => !knownTagIds.has(tagId)));
  return [
    ...tagGroups,
    ...(unknownTagged.length > 0 ? [{id: 'tag:unknown', label: '未知标签', tasks: unknownTagged}] : []),
    ...(untagged.length > 0 ? [{id: 'tag:none', label: '无标签', tasks: untagged}] : []),
  ];
}
