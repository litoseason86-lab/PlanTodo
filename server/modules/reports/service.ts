import type {CategoryRepository} from '../categories/repository';
import type {FocusSessionRepository} from '../focus/repository';
import type {ReportRepository} from './repository';
import type {TaskRepository} from '../tasks/repository';
import {AppError} from '../../shared/errors/appError';
import {renderDailyReport, renderWeeklyReview} from './generators';
import {addIsoDateDays, getChinaDateUtcRange} from '../../../shared/lib/date';
import {focusSessionDurationSeconds, isCountedFocusSession} from '../../../shared/lib/focusSessions';

export class ReportsService {
  constructor(
    private readonly reports: ReportRepository,
    private readonly tasks: Pick<TaskRepository, 'listByFilters' | 'getById'>,
    private readonly categories: Pick<CategoryRepository, 'listByUser'>,
    private readonly sessions: Pick<FocusSessionRepository, 'listByDateRange'>,
  ) {}

  getDaily(userId: number, date: string) {
    const report = this.reports.getDaily(userId, date);
    if (!report) {
      throw new AppError(404, 'No daily report found for this date. Please generate one first.');
    }
    return report;
  }

  generateDaily(userId: number, date: string) {
    const categories = this.categories.listByUser(userId);
    const tasks = this.tasks.listByFilters({userId, plannedDate: date});
    const {startAt, endAt} = getChinaDateUtcRange(date);
    const sessions = this.sessions
      .listByDateRange(userId, startAt, endAt)
      .filter(isCountedFocusSession);

    const doneCount = tasks.filter((task) => task.status === 'DONE').length;
    const notDoneCount = tasks.length - doneCount;
    const categoryDuration = Object.fromEntries(categories.map((category) => [category.name, 0]));

    let totalSeconds = 0;
    for (const session of sessions) {
      const duration = focusSessionDurationSeconds(session);
      totalSeconds += duration;
      const task = tasks.find((item) => item.id === session.taskId) ?? this.tasks.getById(session.taskId, userId);
      if (!task) {
        continue;
      }
      const category = categories.find((item) => item.id === task.categoryId);
      if (category) {
        categoryDuration[category.name] = (categoryDuration[category.name] ?? 0) + duration;
      }
    }

    let topCategoryName = '暂无明显类别';
    let topCategoryDuration = 0;
    const categoryDurationLines: string[] = [];
    for (const [name, seconds] of Object.entries(categoryDuration)) {
      if (seconds <= 0) {
        continue;
      }
      categoryDurationLines.push(`- **${name}**: 累计专注于其 ${Math.floor(seconds / 60)} 分钟`);
      if (seconds > topCategoryDuration) {
        topCategoryDuration = seconds;
        topCategoryName = name;
      }
    }

    return this.reports.saveDaily(
      userId,
      date,
      renderDailyReport({
        date,
        totalTasks: tasks.length,
        doneCount,
        notDoneCount,
        totalSeconds,
        topCategoryName,
        categoryDurationLines,
      }),
    );
  }

  getWeekly(userId: number, weekStart: string) {
    const review = this.reports.getWeekly(userId, weekStart);
    if (!review) {
      throw new AppError(404, 'No weekly review found for this week. Please generate one first.');
    }
    return review;
  }

  generateWeekly(userId: number, weekStart: string) {
    const categories = this.categories.listByUser(userId);
    const weekEnd = addIsoDateDays(weekStart, 6);

    const categoryTaskCounts = Object.fromEntries(categories.map((category) => [category.name, 0]));
    const categoryDurations = Object.fromEntries(categories.map((category) => [category.name, 0]));

    let totalTasks = 0;
    let doneCount = 0;
    let notDoneCount = 0;
    let totalSeconds = 0;
    let maxStreak = 0;
    let currentStreak = 0;

    for (let index = 0; index < 7; index += 1) {
      const date = addIsoDateDays(weekStart, index);
      const dayTasks = this.tasks.listByFilters({userId, plannedDate: date});
      const dayDoneCount = dayTasks.filter((task) => task.status === 'DONE').length;

      totalTasks += dayTasks.length;
      doneCount += dayDoneCount;
      notDoneCount += dayTasks.length - dayDoneCount;

      if (dayTasks.length > 0 && dayDoneCount === dayTasks.length) {
        currentStreak += 1;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      for (const task of dayTasks) {
        const category = categories.find((item) => item.id === task.categoryId);
        if (category) {
          categoryTaskCounts[category.name] = (categoryTaskCounts[category.name] ?? 0) + 1;
        }
      }

      const {startAt, endAt} = getChinaDateUtcRange(date);
      const sessions = this.sessions
        .listByDateRange(userId, startAt, endAt)
        .filter(isCountedFocusSession);

      for (const session of sessions) {
        const duration = focusSessionDurationSeconds(session);
        totalSeconds += duration;
        const task = this.tasks.getById(session.taskId, userId);
        if (!task) {
          continue;
        }
        const category = categories.find((item) => item.id === task.categoryId);
        if (category) {
          categoryDurations[category.name] = (categoryDurations[category.name] ?? 0) + duration;
        }
      }
    }

    const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
    const categoryTaskLines = Object.entries(categoryTaskCounts)
      .filter(([, count]) => count > 0)
      .map(([name, count]) => `- **${name}**：安排了 ${count} 条任务`);
    const categoryDurationLines = Object.entries(categoryDurations)
      .filter(([, seconds]) => seconds > 0)
      .map(([name, seconds]) => `- **${name}**：专注于该项 ${Math.round(seconds / 60)} 分钟`);

    let summary = '本周计划完成率稍低，遇到了比较明显的执行阻力。';
    let advice =
      '通常由于周一到周三的任务承载超负荷，或陷入了外界不可抗力。不要沮丧，下周请采取“缩减战术”：精简 50% 的次要任务，每天聚焦只解决一个核心突破点，先提振执行信心。';

    if (completionRate >= 85) {
      summary = '本周整体表现极佳，是一个高度自律、充满高能产出的黄金周！';
      advice =
        '您的规划能力和执行耐力非常突出。下周可以尝试接触更核心、带有探索属性的高价值项目，打破原有的舒适限制，同时注意适当放松，以防长期紧绷疲惫。';
    } else if (completionRate >= 60) {
      summary = '本周较为稳定地完成了大规划目标，守住了效率主阵地。';
      advice =
        '这属于健康、平衡的执行表现。下周建议将优化点放在提升那些总是被一拖再拖的“困难任务”上——尝试在精力最好的清晨，采用番茄钟机制直接“吞掉青蛙”。';
    } else if (totalTasks === 0) {
      summary = '本周未在系统内规划具体计划和任务指标。';
      advice =
        '空闲期可能是在处理即时性突发需求或正处于调整阶段。下周建议回归系统性规则，每天早上安排 1-2 件最能推动目标的硬币任务，唤醒效率心流。';
    }

    return this.reports.saveWeekly(
      userId,
      weekStart,
      weekEnd,
      renderWeeklyReview({
        weekStart,
        weekEnd,
        totalTasks,
        doneCount,
        notDoneCount,
        completionRate,
        totalSeconds,
        maxStreak,
        categoryTaskLines,
        categoryDurationLines,
        summary,
        advice,
      }),
    );
  }
}
