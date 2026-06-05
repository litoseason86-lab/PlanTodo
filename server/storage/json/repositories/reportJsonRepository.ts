import type {ReportRepository} from '../../../modules/reports/repository';
import type {DailyReport, WeeklyReview} from '../../../../shared/domain/entities';
import {JsonFileStore} from '../fileStore';

export class ReportJsonRepository implements ReportRepository {
  constructor(private readonly store: JsonFileStore) {}

  getDaily(userId: number, reportDate: string): DailyReport | undefined {
    return this.store.read().dailyReports.find((report) => {
      return report.userId === userId && report.reportDate === reportDate;
    });
  }

  saveDaily(userId: number, reportDate: string, content: string): DailyReport {
    return this.store.update((data) => {
      const now = new Date().toISOString();
      const existing = data.dailyReports.find((report) => {
        return report.userId === userId && report.reportDate === reportDate;
      });
      if (existing) {
        existing.content = content;
        existing.updatedAt = now;
        return existing;
      }

      data.sequences.dailyReports += 1;
      const report: DailyReport = {
        id: data.sequences.dailyReports,
        userId,
        reportDate,
        content,
        generatorType: 'RULE_BASED',
        createdAt: now,
        updatedAt: now,
      };
      data.dailyReports.push(report);
      return report;
    });
  }

  getWeekly(userId: number, weekStartDate: string): WeeklyReview | undefined {
    return this.store.read().weeklyReviews.find((review) => {
      return review.userId === userId && review.weekStartDate === weekStartDate;
    });
  }

  saveWeekly(
    userId: number,
    weekStartDate: string,
    weekEndDate: string,
    content: string,
  ): WeeklyReview {
    return this.store.update((data) => {
      const now = new Date().toISOString();
      const existing = data.weeklyReviews.find((review) => {
        return review.userId === userId && review.weekStartDate === weekStartDate;
      });
      if (existing) {
        existing.content = content;
        existing.weekEndDate = weekEndDate;
        existing.updatedAt = now;
        return existing;
      }

      data.sequences.weeklyReviews += 1;
      const review: WeeklyReview = {
        id: data.sequences.weeklyReviews,
        userId,
        weekStartDate,
        weekEndDate,
        content,
        generatorType: 'RULE_BASED',
        createdAt: now,
        updatedAt: now,
      };
      data.weeklyReviews.push(review);
      return review;
    });
  }
}

