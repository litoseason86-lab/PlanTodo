import type {DailyReport, WeeklyReview} from '../../../shared/domain/entities';

export interface ReportRepository {
  getDaily(userId: number, reportDate: string): DailyReport | undefined;
  saveDaily(userId: number, reportDate: string, content: string): DailyReport;
  getWeekly(userId: number, weekStartDate: string): WeeklyReview | undefined;
  saveWeekly(
    userId: number,
    weekStartDate: string,
    weekEndDate: string,
    content: string,
  ): WeeklyReview;
}

