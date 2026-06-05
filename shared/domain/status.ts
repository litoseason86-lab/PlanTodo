export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SESSION_STATUSES = ['RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const REPORT_GENERATOR_TYPES = ['RULE_BASED'] as const;

export type ReportGeneratorType = (typeof REPORT_GENERATOR_TYPES)[number];
