import type Database from 'better-sqlite3';

interface Migration {
  version: number;
  name: string;
  sql?: string;
  apply?: (db: Database.Database) => void;
  transaction?: boolean;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      create table if not exists users (
        id integer primary key,
        username text not null,
        display_name text not null,
        created_at text not null
      );

      create table if not exists categories (
        id integer primary key,
        user_id integer not null,
        name text not null,
        color text not null,
        sort_order integer not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id)
      );

      create table if not exists tasks (
        id integer primary key,
        user_id integer not null,
        category_id integer not null,
        title text not null,
        planned_date text not null,
        status text not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id),
        foreign key (category_id) references categories(id)
      );

      create index if not exists idx_tasks_user_date on tasks(user_id, planned_date);
      create index if not exists idx_tasks_user_status on tasks(user_id, status);
      create index if not exists idx_tasks_user_category on tasks(user_id, category_id);

      create table if not exists task_execution_sessions (
        id integer primary key,
        task_id integer not null,
        user_id integer not null,
        started_at text not null,
        ended_at text,
        duration_seconds integer,
        status text not null,
        created_at text not null,
        task_title text,
        foreign key (task_id) references tasks(id),
        foreign key (user_id) references users(id)
      );

      create index if not exists idx_sessions_user_status on task_execution_sessions(user_id, status);
      create index if not exists idx_sessions_user_started on task_execution_sessions(user_id, started_at);
      create index if not exists idx_sessions_task on task_execution_sessions(task_id);

      create table if not exists daily_reports (
        id integer primary key,
        user_id integer not null,
        report_date text not null,
        content text not null,
        generator_type text not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id),
        unique(user_id, report_date)
      );

      create table if not exists weekly_reviews (
        id integer primary key,
        user_id integer not null,
        week_start_date text not null,
        week_end_date text not null,
        content text not null,
        generator_type text not null,
        created_at text not null,
        updated_at text not null,
        foreign key (user_id) references users(id),
        unique(user_id, week_start_date)
      );

      insert into users (id, username, display_name, created_at)
      values (1, 'demo', 'Demo User', datetime('now'))
      on conflict(id) do nothing;
    `,
  },
  {
    version: 2,
    name: 'focus_pause_resume',
    sql: `
      alter table task_execution_sessions add column paused_at text;
      alter table task_execution_sessions add column accumulated_pause_seconds integer not null default 0;
    `,
  },
  {
    version: 3,
    name: 'task_schedule_fields',
    sql: `
      alter table tasks add column planned_end_date text;
      alter table tasks add column start_at text;
      alter table tasks add column end_at text;
      alter table tasks add column all_day integer not null default 1;

      create index if not exists idx_tasks_user_planned_end_date on tasks(user_id, planned_end_date);
      create index if not exists idx_tasks_user_start_at on tasks(user_id, start_at);
    `,
  },
  {
    version: 4,
    name: 'nullable_task_planned_date',
    transaction: false,
    apply(db) {
      db.pragma('foreign_keys = OFF');
      try {
        db.exec('begin');
        db.exec(`
          create table tasks_new (
            id integer primary key,
            user_id integer not null,
            category_id integer not null,
            title text not null,
            planned_date text,
            status text not null,
            created_at text not null,
            updated_at text not null,
            planned_end_date text,
            start_at text,
            end_at text,
            all_day integer not null default 1,
            foreign key (user_id) references users(id),
            foreign key (category_id) references categories(id)
          );

          insert into tasks_new (
            id, user_id, category_id, title, planned_date, status, created_at, updated_at,
            planned_end_date, start_at, end_at, all_day
          )
          select
            id, user_id, category_id, title, planned_date, status, created_at, updated_at,
            planned_end_date, start_at, end_at, all_day
          from tasks;

          drop table tasks;
          alter table tasks_new rename to tasks;

          create index if not exists idx_tasks_user_date on tasks(user_id, planned_date);
          create index if not exists idx_tasks_user_status on tasks(user_id, status);
          create index if not exists idx_tasks_user_category on tasks(user_id, category_id);
          create index if not exists idx_tasks_user_planned_end_date on tasks(user_id, planned_end_date);
          create index if not exists idx_tasks_user_start_at on tasks(user_id, start_at);
        `);
        const violations = db.pragma('foreign_key_check') as unknown[];
        if (violations.length > 0) {
          throw new Error('SQLite foreign key check failed after nullable planned_date migration');
        }
        db.exec('commit');
      } catch (error) {
        db.exec('rollback');
        throw error;
      } finally {
        db.pragma('foreign_keys = ON');
      }
    },
  },
];

function applyMigrationSql(db: Database.Database, migration: Migration): void {
  if (migration.sql) {
    db.exec(migration.sql);
    return;
  }
  migration.apply?.(db);
}

export function runMigrations(db: Database.Database): void {
  db.exec(`
    create table if not exists schema_migrations (
      version integer primary key,
      name text not null,
      executed_at text not null
    );
  `);

  const applied = new Set(
    (db.prepare('select version from schema_migrations').all() as Array<{version: number}>).map((row) => row.version),
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    const applyAndRecord = () => {
      applyMigrationSql(db, migration);
      db.prepare('insert into schema_migrations (version, name, executed_at) values (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    };

    if (migration.transaction === false) {
      applyAndRecord();
    } else {
      db.transaction(applyAndRecord)();
    }
  }
}
