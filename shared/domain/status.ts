export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const SESSION_STATUSES = ['RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const REPORT_GENERATOR_TYPES = ['RULE_BASED'] as const;

export type ReportGeneratorType = (typeof REPORT_GENERATOR_TYPES)[number];
