import { db, Category, Task, TaskExecutionSession } from './db';

export interface DailyReportStats {
  date: string;
  totalTasks: number;
  doneCount: number;
  notDoneCount: number;
  totalSeconds: number;
  categoryDuration: { [categoryName: string]: number };
}

export interface WeeklyReviewStats {
  weekStart: string;
  weekEnd: string;
  totalTasks: number;
  doneCount: number;
  notDoneCount: number;
  completionRate: number; // percentage (0 - 100)
  categoryTaskCounts: { [categoryName: string]: number };
  categoryDuration: { [categoryName: string]: number };
  continuousDoneDays: number;
}

export function generateDailyReportContent(userId: number, dateStr: string): string {
  const categories = db.getCategories(userId);
  const tasks = db.getTasks(userId, dateStr);
  
  const doneCount = tasks.filter(t => t.status === 'DONE').length;
  // Tasks in progress, todo or marked NOT_DONE are not fully completed
  const notDoneCount = tasks.filter(t => t.status !== 'DONE').length;

  // Let's gather the sessions for this day
  // Start limit is this day at 00:00:00, end is 23:59:59
  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;
  const sessions = db.getSessionsByDateRange(userId, startOfDay, endOfDay)
    .filter(s => s.status === 'COMPLETED');

  let totalSeconds = 0;
  const categoryDurationMap: { [catName: string]: number } = {};

  // Setup category map
  categories.forEach(c => {
    categoryDurationMap[c.name] = 0;
  });

  sessions.forEach(s => {
    const duration = s.durationSeconds || 0;
    totalSeconds += duration;

    const task = tasks.find(t => t.id === s.taskId) || db.getTaskByIdAndUserId(s.taskId, userId);
    if (task) {
      const cat = categories.find(c => c.id === task.categoryId);
      if (cat) {
        categoryDurationMap[cat.name] = (categoryDurationMap[cat.name] || 0) + duration;
      }
    }
  });

  // Convert total seconds to hours and minutes
  const totalMins = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;
  
  // Format category breakdowns
  let maxDurationCatName = '暂无明显类别';
  let maxDuration = 0;
  const itemizedList: string[] = [];

  Object.entries(categoryDurationMap).forEach(([name, sec]) => {
    if (sec > 0) {
      const mins = Math.floor(sec / 60);
      itemizedList.push(`- **${name}**: 累计专注于其 ${mins} 分钟`);
      if (sec > maxDuration) {
        maxDuration = sec;
        maxDurationCatName = name;
      }
    }
  });

  const categoryFocusSection = itemizedList.length > 0 
    ? itemizedList.join('\n') 
    : '今天没有记录任何类别的专注计时。建议通过专注引擎记录您的工作。';

  const ratio = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

  // Render elegant professional report
  const report = `## 📊 ${dateStr} 每日执行状态报告

### 一、 任务完成情况概要
- **计划任务总数**： ${tasks.length} 个
- **已完成任务数**： ${doneCount} 个
- **未完成任务数**： ${notDoneCount} 个
- **计划执行完成率**： ${ratio}%

### 二、 深度专注时长分析
- **今日累计专注时间**： ${hours}小时 ${minutes}分钟
- **投入精力最多的领域**： **${maxDurationCatName}**
  
**各板块专注明细：**
${categoryFocusSection}

### 三、 执行分析与自我复盘反馈 (智能规则生成)
${ratio === 100 
  ? `恭喜！今天完成了全部任务列表 (${doneCount}/${tasks.length})！执行力判定为 **卓越**。保持这个绝佳的状态，建议在明天的计划中适度增加一些自驱性挑战。`
  : ratio >= 70 
  ? `今天完成了大部分计划 (${doneCount}/${tasks.length})，执行力表现为 **优秀**。针对未完成的 ${notDoneCount} 个任务，建议在今晚复盘并决定是直接合理顺延至明天还是进行优先级剥离。`
  : ratio >= 40
  ? `今天完成了约半数计划 (${doneCount}/${tasks.length})，执行力表现为 **中等**。当前可能存在执行过程被分散或任务定级偏大的情况。建议将难点任务拆解至半小时以内，重新找回心流节奏。`
  : tasks.length === 0
  ? `今天任务看板上没有任何计划。放空或思考未来是完全合理的。若这是工作日，建议在今晚抽 5 分钟定义明天的 3 个关键任务 (MIT)。`
  : `今天任务执行率较低 (${ratio}%)。请不要气馁，执行障碍通常来自计划过于臃肿或外部干扰过多。建议不要掩盖拖延，明天的计划先从一件 15 分钟能搞定的小事作为突破口开始。`
}`;

  return report;
}

export function generateWeeklyReviewContent(userId: number, weekStartStr: string): string {
  const categories = db.getCategories(userId);
  
  // Calculate end of the week (7 days)
  const weekStart = new Date(weekStartStr);
  const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  // Collect tasks within the week scope
  let totalTasksCount = 0;
  let doneTasksCount = 0;
  let notDoneTasksCount = 0;

  const categoryTaskMap: { [catName: string]: number } = {};
  const categoryDurationMap: { [catName: string]: number } = {};
  
  categories.forEach(c => {
    categoryTaskMap[c.name] = 0;
    categoryDurationMap[c.name] = 0;
  });

  // Loop of 7 days to gather and calculate continuous index
  const daysCompleted: { [dateStr: string]: boolean } = {};
  let totalSeconds = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dStr = d.toISOString().slice(0, 10);
    
    const dayTasks = db.getTasks(userId, dStr);
    const dayDone = dayTasks.filter(t => t.status === 'DONE').length;
    
    totalTasksCount += dayTasks.length;
    doneTasksCount += dayDone;
    notDoneTasksCount += (dayTasks.length - dayDone);
    
    daysCompleted[dStr] = dayTasks.length > 0 && dayDone === dayTasks.length;

    // Sum category tasks
    dayTasks.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      if (cat) {
        categoryTaskMap[cat.name] = (categoryTaskMap[cat.name] || 0) + 1;
      }
    });

    // Sum sessions
    const startOfDay = `${dStr}T00:00:00.000Z`;
    const endOfDay = `${dStr}T23:59:59.999Z`;
    const daySessions = db.getSessionsByDateRange(userId, startOfDay, endOfDay)
      .filter(s => s.status === 'COMPLETED');

    daySessions.forEach(s => {
      const duration = s.durationSeconds || 0;
      totalSeconds += duration;
      
      const task = db.getTaskByIdAndUserId(s.taskId, userId);
      if (task) {
        const cat = categories.find(c => c.id === task.categoryId);
        if (cat) {
          categoryDurationMap[cat.name] = (categoryDurationMap[cat.name] || 0) + duration;
        }
      }
    });
  }

  // Calculate continuous streaks
  let maxStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart.getTime() + i * 24 * 60 * 60 * 1000);
    const dStr = d.toISOString().slice(0, 10);
    if (daysCompleted[dStr]) {
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
    } else {
      currentStreak = 0;
    }
  }

  const completionRate = totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;
  const totalMins = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;

  // Category task distribution details
  const catTasksDetails = Object.entries(categoryTaskMap)
    .filter(([_, count]) => count > 0)
    .map(([name, count]) => `- **${name}**：安排了 ${count} 条任务`)
    .join('\n');

  // Category focus duration details
  const catDurationDetails = Object.entries(categoryDurationMap)
    .filter(([_, sec]) => sec > 0)
    .map(([name, sec]) => `- **${name}**：专注于该项 ${(sec / 60).toFixed(0)} 分钟`)
    .join('\n');

  // Next week's custom advice based on performance statistics
  let performanceSummary = '';
  let advice = '';

  if (completionRate >= 85) {
    performanceSummary = '本周整体表现极佳，是一个高度自律、充满高能产出的黄金周！';
    advice = '您的规划能力和执行耐力非常突出。下周可以尝试接触更核心、带有探索属性的高价值项目，打破原有的舒适限制，同时注意适当放松，以防长期紧绷疲惫。';
  } else if (completionRate >= 60) {
    performanceSummary = '本周较为稳定地完成了大规划目标，守住了效率主阵地。';
    advice = '这属于健康、平衡的执行表现。下周建议将优化点放在提升那些总是被一拖再拖的“困难任务”上——尝试在精力最好的清晨，采用番茄钟机制直接“吞掉青蛙”。';
  } else if (totalTasksCount === 0) {
    performanceSummary = '本周未在系统内规划具体计划和任务指标。';
    advice = '空闲期可能是在处理即时性突发需求或正处于调整阶段。下周建议回归系统性规则，每天早上安排 1-2 件最能推动目标的硬币任务，唤醒效率心流。';
  } else {
    performanceSummary = '本周计划完成率稍低，遇到了比较明显的执行阻力。';
    advice = '通常由于周一到周三的任务承载超负荷，或陷入了外界不可抗力。不要沮丧，下周请采取“缩减战术”：精简 50% 的次要任务，每天聚焦只解决一个核心突破点，先提振执行信心。';
  }

  const review = `## 📅 周度深度复盘与效率周志 (第 [${weekStartStr} ~ ${weekEndStr}] 周)

### 一、 本周指标硬数据汇总
- **任务规划总量**： ${totalTasksCount} 个
- **顺利执行完成**： ${doneTasksCount} 个  *(完成率：${completionRate}%)*
- **未达预期滞留**： ${notDoneTasksCount} 个
- **本周总计时深度专注**： ${hours}小时 ${minutes}分钟
- **单周任务100%全清零天数**： ${maxStreak} 天

### 二、 业务分类看板 & 精力流向
**1. 任务规划分布：**
${catTasksDetails || '暂无分类任务排期。'}

**2. 专注力投入流向：**
${catDurationDetails || '暂无专注明细。'}

### 三、 总结评估与发展指南
* **本周评语**： ${performanceSummary}
* **下周高效行动指引**： ${advice}`;

  return review;
}
