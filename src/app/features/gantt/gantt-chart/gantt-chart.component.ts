import { Component, OnInit, inject, ChangeDetectorRef, ElementRef, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Project, ProjectService, GanttTaskDisplayItem, 
  // NewGanttTaskData

 } from '../../../core/project.service'; // GanttTaskUpdatePayload は不要なので削除も検討
import { TaskService, 
  // NewDailyLogData,
   Task, } from '../../../core/task.service'; // DailyLog をインポート
import { Timestamp, serverTimestamp } from '@angular/fire/firestore'; // serverTimestamp をインポート
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddTaskDialogComponent } from './components/add-task-dialog/add-task-dialog.component';
import { MatButtonModule } from '@angular/material/button';
// import { ConfirmDialogComponent, ConfirmDialogData } from './components/confirm-dialog/confirm-dialog.component';
import { Router, ActivatedRoute } from '@angular/router';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom, of, Observable } from 'rxjs';
import { catchError, switchMap, 
  //tap
 } from 'rxjs/operators';
import { GanttChartTask } from '../../../core/models/gantt-chart-task.model'; 
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs/operators';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserService } from '../../../core/user.service';
import { User as AppUser } from '../../../core/models/user.model';

interface TimelineDay {
  dayNumber: number; // 日 (1, 2, ..., 31)
  isWeekend: boolean;
}

interface TimelineMonth {
  year: number;
  month: number; // 1-12
  monthName: string; // 例: "5月"
  daysInMonth: number; // その月の日数
  colspan: number; // この月がいくつの日付セルにまたがるか (通常はdaysInMonthと同じ)
  days: TimelineDay[];
}

interface TimelineYear {
  year: number;
  colspan: number; // この年がいくつの日付セルにまたがるか
  months: TimelineMonth[];
}



@Component({
  selector: 'app-gantt-chart',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    FormsModule,
    MatFormFieldModule,
    MatTooltipModule,
  ],
  templateUrl: './gantt-chart.component.html',
  styleUrl: './gantt-chart.component.scss'
})


export class GanttChartComponent implements OnInit {
  private route: ActivatedRoute = inject(ActivatedRoute);
  private projectService: ProjectService = inject(ProjectService);
  private taskService: TaskService = inject(TaskService); // ★ TaskService がインジェクトされているか確認
  private cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private router: Router = inject(Router);  
  private userService: UserService = inject(UserService);

  project$: Observable<Project | undefined> | undefined;
  tasks$: Observable<GanttChartTask[]> | undefined;
  projectId: string | null = null;
  isLoadingProject = true;
  isLoadingTasks = true;
  projectError: string | null = null;
  tasksError: string | null = null;
  selectedTask: GanttChartTask | null = null;
  private el: ElementRef<HTMLElement> = inject(ElementRef);
  ganttTasks: GanttChartTask[] = []; 

  totalTimelineWidthPx = 0;
  readonly TASK_ROW_HEIGHT_PX = 40;
  public readonly DAY_CELL_WIDTH = 50; // 1日のセルの幅 (px) テンプレートから参照できるようにpublicに

  readonly dummyDate = new Date(0);

  @HostBinding('style.--row-height') get cssRowHeight() { return this.TASK_ROW_HEIGHT_PX + 'px'; }
  @HostBinding('style.--day-cell-width') get cssDayCellWidth() { return this.DAY_CELL_WIDTH + 'px'; }
  @HostBinding('style.--task-count') get cssTaskCount() { return (this.ganttTasks?.length || 1).toString(); }

  public _project: Project | undefined;

  get projectName(): string | undefined {
    return this._project?.name;
  }
  get projectStartDate(): Date | null {
    const s = this._project?.startDate;
    if (!s) return null;
    if (s instanceof Date) return s;
    if (this.isTimestamp(s)) return s.toDate();
    return null;
  }
  get projectEndDate(): Date | null {
    const e = this._project?.endDate;
    if (!e) return null;
    if (e instanceof Date) return e;
    if (this.isTimestamp(e)) return e.toDate();
    return null;
  }

  userMap: Record<string, AppUser> = {};

  constructor(
    public dialog: MatDialog
    // private el: ElementRef, // ElementRef は一旦コメントアウトまたは削除
  ) {
    // this.el = el; // ElementRef を使う場合はプロパティ宣言が必要
  }

  private generateTimelineHeaders(): void {
    this.timelineYears = []; // 初期化
    this.allDaysInTimeline = []; // 初期化
    const startDate = new Date(this.timelineStartDate);
    const endDate = new Date(this.timelineEndDate);

    let currentYear = -1;
    let currentMonth = -1;
    let yearObj: TimelineYear | undefined;
    let monthObj: TimelineMonth | undefined;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-12
      const day = d.getDate();
      const dayOfWeek = d.getDay(); // 0 (日) - 6 (土)

      // 年ヘッダーの処理
      if (year !== currentYear) {
        currentYear = year;
        yearObj = { year: currentYear, months: [], colspan: 0 };
        this.timelineYears.push(yearObj);
        currentMonth = -1; // 年が変わったら月もリセット
      }

      // 月ヘッダーの処理
      if (month !== currentMonth) {
        currentMonth = month;
        monthObj = { 
          year: currentYear, 
          month: currentMonth, 
          monthName: `${currentMonth}月`, 
          daysInMonth: new Date(currentYear, currentMonth, 0).getDate(), // 月の日数を取得
          colspan: 0, 
          days: [] 
        };
        if (yearObj) { // yearObjがundefinedでないことを確認
          yearObj.months.push(monthObj);
        }
      }

      // 日ヘッダーの処理
      const dayCell: TimelineDay = { 
        dayNumber: day, 
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        // date: new Date(d) // 必要であれば完全な日付も保持
      };

      if (monthObj) { // monthObjがundefinedでないことを確認
        monthObj.days.push(dayCell);
        monthObj.colspan++; // 月のcolspanをインクリメント
      }
      if (yearObj) { // yearObjがundefinedでないことを確認
        yearObj.colspan++; // 年のcolspanをインクリメント
      }
      this.allDaysInTimeline.push(dayCell); // 全ての日をフラットな配列にも追加
    }
  }


  timelineYears: TimelineYear[] = [];
  timelineStartDate: Date = new Date(2025, 3, 1); // 2025年4月1日 (Dateの月は0から)
  timelineEndDate: Date = new Date(2025, 5, 30);  // 2025年6月30日
  allDaysInTimeline: TimelineDay[] = []

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => {
        this.projectId = params.get('projectId');
        this.isLoadingProject = true;
        this.projectError = null;
        this.tasks$ = undefined; // プロジェクトIDが変わるたびにタスクをリセット

        if (this.projectId) {
          this.loadTasksForProject(this.projectId);
          return this.projectService.getProject(this.projectId);
        } else {
          this.isLoadingProject = false;
          this.projectError = 'プロジェクトIDが見つかりません。';
          return of(undefined); // Projectが見つからない場合は undefined を返す Observable
        }
      })
    ).subscribe({
      next: (project) => {
        this.project$ = of(project);
        this._project = project ?? undefined;
        this.isLoadingProject = false;

        if (project && project.startDate && project.endDate) {
          // project.startDate と project.endDate が Timestamp インスタンスであることを確認
          if (this.isTimestamp(project.startDate) && this.isTimestamp(project.endDate)) {
            this.timelineStartDate = project.startDate.toDate();
            this.timelineEndDate = project.endDate.toDate();
          } else {
            // 万が一 Timestamp 型でなかった場合のフォールバック
            console.error('Project startDate or endDate is not a Timestamp object.');
            this.timelineStartDate = new Date();
            this.timelineEndDate = new Date();
            this.timelineEndDate.setMonth(this.timelineEndDate.getMonth() + 1);
          }
          this.generateTimelineHeaders();
          this.calculateTotalTimelineWidth();
        } else if (project) {
          console.warn('プロジェクトに開始日または終了日が設定されていません。デフォルト期間を使用します。');
          this.timelineStartDate = new Date();
          this.timelineEndDate = new Date();
          this.timelineEndDate.setMonth(this.timelineEndDate.getMonth() + 3);
          this.generateTimelineHeaders();
          this.calculateTotalTimelineWidth();
        } else if (this.projectId) {
          this.projectError = `プロジェクト (ID: ${this.projectId}) が見つかりません。タイムラインはデフォルトで表示します。`;
          this.timelineStartDate = new Date();
          this.timelineEndDate = new Date();
          this.timelineEndDate.setMonth(this.timelineEndDate.getMonth() + 3);
          this.generateTimelineHeaders();
          this.calculateTotalTimelineWidth();
        }

        // 管理者・担当者IDを集めてユーザー情報を一括取得
        const managerIds = project?.managerIds ?? (project?.managerId ? [project.managerId] : []);
        const memberIds = project?.members ?? [];
        const allUserIds = Array.from(new Set([...(managerIds ?? []), ...(memberIds ?? [])]));
        if (allUserIds.length > 0) {
          this.userService.getUsersByIds(allUserIds).subscribe(users => {
            this.userMap = {};
            users.forEach(u => { this.userMap[u.id] = u; });
            this.cdr.markForCheck();
          });
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('プロジェクト情報の取得エラー:', err);
        this.projectError = 'プロジェクト情報の取得中にエラーが発生しました。';
        this.isLoadingProject = false;
      }
    });
  }

  loadTasksForProject(projectId: string): void {
    this.isLoadingTasks = true;
    this.tasksError = null;
  
    this.taskService.getGanttChartTasksByProjectId(projectId).subscribe({
      next: (ganttTasks: GanttChartTask[]) => {
        this.ganttTasks = ganttTasks; // ★ 取得したタスクをそのまま代入
        this.isLoadingTasks = false;
  
        // ここからガントバーの期間出力
        console.log('--- ガントバー出力 ---');
        ganttTasks.forEach(task => {
          let start: Date | null = null;
          let end: Date | null = null;
          if (task.plannedStartDate && typeof task.plannedStartDate.toDate === 'function') {
            start = task.plannedStartDate.toDate();
          } else if (task.plannedStartDate instanceof Date) {
            start = task.plannedStartDate;
          }
          if (task.plannedEndDate && typeof task.plannedEndDate.toDate === 'function') {
            end = task.plannedEndDate.toDate();
          } else if (task.plannedEndDate instanceof Date) {
            end = task.plannedEndDate;
          }
          const left = start ? this.getBarLeftPosition(start) : 'N/A';
          const width = (start && end) ? this.getBarWidth(start, end) : 'N/A';
          console.log(
            `タスク: ${task.title}, 開始: ${start ? start.toLocaleDateString() : 'N/A'}, 終了: ${end ? end.toLocaleDateString() : 'N/A'}, left: ${left}, width: ${width}`
          );
        });
        // ここまで

        if (ganttTasks.length > 0) {
          // タイムラインヘッダーの生成ロジックは、タスクの日付範囲を使うように後で調整が必要かもしれません。
          // まずはタスクが表示されることを確認しましょう。
          this.generateTimelineHeaders();
        } else {
          this.timelineYears = [];
          this.allDaysInTimeline = [];
        }
        this.cdr.detectChanges(); // UIに変更を反映
      },
      error: (err) => {
        console.error('[GanttChartComponent] Error fetching GanttChartTasks:', err);
        this.tasksError = 'タスクの取得中にエラーが発生しました。';
        this.isLoadingTasks = false;
        this.ganttTasks = [];
        this.timelineYears = [];
        this.allDaysInTimeline = [];
        this.cdr.detectChanges();
      }
    });
  }

  



private mapProjectsToGanttItems(projects: Project[]): GanttTaskDisplayItem[] { // ★ 返り値の型を変更
  return projects.map(project => {
    const ganttItem: GanttTaskDisplayItem = {
      id: project.id,
      name: project.name,
      title: project.name, // 例: nameと同じ値をセット
      projectId: project.id, // 例: プロジェクトIDをセット（適切な値に変更してください）
      assigneeId: '', // 例: 空文字や適切な値をセット
      blockerStatus: null, // 例: nullや適切な値をセット
      plannedStartDate: project.startDate instanceof Date
        ? project.startDate
        : (project.startDate instanceof Timestamp
            ? project.startDate.toDate()
            : new Date()),
      plannedEndDate: project.endDate instanceof Date
        ? project.endDate
        : (project.endDate instanceof Timestamp
            ? project.endDate.toDate()
            : new Date(new Date().setDate(new Date().getDate() + 7))),
      status: project.status === 'active' ? 'doing' : (project.status === 'completed' ? 'done' : 'todo'),
      // 他の必須・オプショナルプロパティも同様に追加
      progress: null,
      level: 0,
      parentId: null,
      wbsNumber: '',
      category: null,
      otherAssigneeIds: [],
      decisionMakerId: null,
    };
    return ganttItem;
  });
}


  getBarLeftPosition(startDate: Date): number { // 引数は Date 型を期待
  if (!this.timelineStartDate || !startDate || !(startDate instanceof Date)) { // ★ startDate が Date インスタンスか確認
    return 0;
  }
  const diffTime = startDate.getTime() - this.timelineStartDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const leftPosition = Math.max(0, diffDays) * this.DAY_CELL_WIDTH;
  return leftPosition;
}

// ... (getBarLeftPosition の後)

getBarWidth(startDate: Date, endDate: Date): number {
  if (!startDate || !endDate || !(startDate instanceof Date) || !(endDate instanceof Date) || endDate < startDate) {
    return 0;
  }

  // 時刻部分をリセットして日付のみで期間を計算
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  // 期間の日数計算 (ミリ秒差を日数に変換し、+1することで開始日と終了日を含む日数を算出)
  const durationDays = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;


  const barWidth = durationDays * this.DAY_CELL_WIDTH;
  return barWidth;
}

navigateToTaskDetail(taskId: string): void {
  if (taskId) {
    this.router.navigate(['/app/tasks', taskId]);
  } else {
    console.error('Task ID is missing, cannot navigate to task detail.');
  }
}

// gantt-chart.component.ts

// ... (import文や他の部分はそのまま) ...

openAddTaskDialog(): void {
  if (!this.projectId) {
    console.error('プロジェクトIDがありません。');
    alert('プロジェクトが選択されていません。');
    return;
  }

  const dialogRef = this.dialog.open(AddTaskDialogComponent, {
    width: '400px',
    data: {
      isEditMode: false,
      task: null,
      projectId: this.projectId,
      minDate: this.projectStartDate ? this.projectStartDate.toISOString().slice(0, 10) : null,
      maxDate: this.projectEndDate ? this.projectEndDate.toISOString().slice(0, 10) : null
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result && result.title && result.plannedStartDate && result.plannedEndDate) {
      const toTimestamp = (val: unknown): Timestamp | null => {
        if (!val) return null;
        if (val instanceof Timestamp) return val;
        if (val instanceof Date) return Timestamp.fromDate(val);
        if (typeof val === 'string' || typeof val === 'number') {
          const d = new Date(val);
          return isNaN(d.getTime()) ? null : Timestamp.fromDate(d);
        }
        if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
          return Timestamp.fromDate((val as { toDate: () => Date }).toDate());
        }
        return null;
      };
      const plannedStartDate = toTimestamp(result.plannedStartDate);
      const plannedEndDate = toTimestamp(result.plannedEndDate);
      const dueDate = toTimestamp(result.dueDate);
      const actualStartDate = toTimestamp(result.actualStartDate);
      const actualEndDate = toTimestamp(result.actualEndDate);
      if (!plannedStartDate || !plannedEndDate) {
        alert('開始日または終了日が不正です。');
        return;
      }
      const newTaskData: Omit<GanttChartTask, 'id' | 'createdAt'> = {
        projectId: this.projectId!,
        title: result.title,
        plannedStartDate,
        plannedEndDate,
        status: result.status,
        assigneeId: result.assigneeId ?? null,
        dueDate,
        blockerStatus: null,
        actualStartDate,
        actualEndDate,
        progress: 0,
      };
      console.log('Firestoreに保存するnewTaskData:', newTaskData);
      this.taskService.addGanttChartTask(newTaskData) // TaskServiceのメソッド呼び出し
        .then(() => {
          alert('タスク「' + newTaskData.title + '」を保存しました！');
          if (this.projectId) {
            this.loadTasksForProject(this.projectId);
          }
        })
        .catch(() => {
          alert('タスクの保存に失敗しました。コンソールを確認してください。');
        });
    }
  });
}

openEditTaskDialog(taskToEdit: GanttChartTask): void {
  if (!taskToEdit || !taskToEdit.id) {
    console.error('編集対象のタスクまたはタスクIDが無効です。');
    alert('エラー: 編集対象のタスク情報が正しくありません。');
    return;
  }

  const dialogRef = this.dialog.open(AddTaskDialogComponent, {
    width: '400px',
    data: {
      isEditMode: true,
      task: { ...taskToEdit },
      projectId: this.projectId,
      minDate: this.projectStartDate ? this.projectStartDate.toISOString().slice(0, 10) : null,
      maxDate: this.projectEndDate ? this.projectEndDate.toISOString().slice(0, 10) : null
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      const updatedTaskData: Partial<GanttChartTask> = {
        title: result.title,
        status: result.status,
      };
      // plannedStartDate
      if (Object.prototype.hasOwnProperty.call(result, 'plannedStartDate')) {
        if (result.plannedStartDate === null) {
          updatedTaskData.plannedStartDate = null as unknown as Timestamp;
        } else if (this.isTimestamp(result.plannedStartDate)) {
          updatedTaskData.plannedStartDate = result.plannedStartDate as Timestamp;
        } else if (typeof result.plannedStartDate === 'string' && !isNaN(new Date(result.plannedStartDate).getTime())) {
          updatedTaskData.plannedStartDate = Timestamp.fromDate(new Date(result.plannedStartDate));
        } else if (result.plannedStartDate instanceof Date && !isNaN(result.plannedStartDate.getTime())) {
          updatedTaskData.plannedStartDate = Timestamp.fromDate(result.plannedStartDate);
        }
      }
      // plannedEndDate
      if (Object.prototype.hasOwnProperty.call(result, 'plannedEndDate')) {
        if (result.plannedEndDate === null) {
          updatedTaskData.plannedEndDate = null as unknown as Timestamp;
        } else if (this.isTimestamp(result.plannedEndDate)) {
          updatedTaskData.plannedEndDate = result.plannedEndDate as Timestamp;
        } else if (typeof result.plannedEndDate === 'string' && !isNaN(new Date(result.plannedEndDate).getTime())) {
          updatedTaskData.plannedEndDate = Timestamp.fromDate(new Date(result.plannedEndDate));
        } else if (result.plannedEndDate instanceof Date && !isNaN(result.plannedEndDate.getTime())) {
          updatedTaskData.plannedEndDate = Timestamp.fromDate(result.plannedEndDate);
        }
      }
      // actualStartDate
      if (Object.prototype.hasOwnProperty.call(result, 'actualStartDate')) {
        if (result.actualStartDate === null) {
          updatedTaskData.actualStartDate = null as unknown as Timestamp;
        } else if (this.isTimestamp(result.actualStartDate)) {
          updatedTaskData.actualStartDate = result.actualStartDate as Timestamp;
        } else if (typeof result.actualStartDate === 'string' && !isNaN(new Date(result.actualStartDate).getTime())) {
          updatedTaskData.actualStartDate = Timestamp.fromDate(new Date(result.actualStartDate));
        } else if (result.actualStartDate instanceof Date && !isNaN(result.actualStartDate.getTime())) {
          updatedTaskData.actualStartDate = Timestamp.fromDate(result.actualStartDate);
        }
      }
      // actualEndDate
      if (Object.prototype.hasOwnProperty.call(result, 'actualEndDate')) {
        if (result.actualEndDate === null) {
          updatedTaskData.actualEndDate = null as unknown as Timestamp;
        } else if (this.isTimestamp(result.actualEndDate)) {
          updatedTaskData.actualEndDate = result.actualEndDate as Timestamp;
        } else if (typeof result.actualEndDate === 'string' && !isNaN(new Date(result.actualEndDate).getTime())) {
          updatedTaskData.actualEndDate = Timestamp.fromDate(new Date(result.actualEndDate));
        } else if (result.actualEndDate instanceof Date && !isNaN(result.actualEndDate.getTime())) {
          updatedTaskData.actualEndDate = Timestamp.fromDate(result.actualEndDate);
        }
      }
      // assigneeId, dueDate, progress など他のフィールドも同様に処理
      if (Object.prototype.hasOwnProperty.call(result, 'assigneeId')) {
        updatedTaskData.assigneeId = result.assigneeId ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(result, 'dueDate')) {
        if (result.dueDate === null) {
          updatedTaskData.dueDate = null as unknown as Timestamp;
        } else if (this.isTimestamp(result.dueDate)) {
          updatedTaskData.dueDate = result.dueDate as Timestamp;
        } else if (typeof result.dueDate === 'string' && !isNaN(new Date(result.dueDate).getTime())) {
          updatedTaskData.dueDate = Timestamp.fromDate(new Date(result.dueDate));
        } else if (result.dueDate instanceof Date && !isNaN(result.dueDate.getTime())) {
          updatedTaskData.dueDate = Timestamp.fromDate(result.dueDate);
        }
      }
      if (Object.prototype.hasOwnProperty.call(result, 'progress')) {
        updatedTaskData.progress = result.progress;
      }
      // undefined のプロパティを削除
      Object.keys(updatedTaskData).forEach(keyStr => {
        const key = keyStr as keyof Partial<GanttChartTask>;
        if (updatedTaskData[key] === undefined) {
          delete updatedTaskData[key];
        }
      });
      if (Object.keys(updatedTaskData).length === 0) {
        return;
      }
      this.taskService.updateGanttChartTask(taskToEdit.id!, updatedTaskData)
        .then(() => {
          alert('タスクを更新しました。');
          if (this.projectId) {
            this.loadTasksForProject(this.projectId);
          }
        })
        .catch(() => {
          alert('タスクの更新に失敗しました。コンソールを確認してください。');
        });
    }
  });
}

public trackByTaskId(index: number, item: GanttChartTask): string {
  return item && item.id ? item.id : index.toString();
}

selectTask(task: GanttChartTask | null): void {
  if (this.selectedTask && task && this.selectedTask.id === task.id) {
    this.selectedTask = null;
  } else {
    this.selectedTask = task;
  }
  // ここで変更検知を明示的にトリガー
  this.cdr.detectChanges();
}

// タスク詳細ページへ遷移する（GanttChartTasks用）
goToGanttTaskDetail(task: GanttChartTask): void {
  if (task && task.id) {
    this.router.navigate(['/app/gantt-task-detail', task.id]);
  }
}

//     // gantt-chart.component.ts

//  // ... (import文や他のプロパティ・メソッドは変更なし) ...

//  confirmDeleteTask(): void {
//   if (!this.selectedTask) {
//     // console.warn('削除対象のタスクが選択されていません。');
//     // 必要であればユーザーへの通知（Snackbarなど）
//     return;
//   }

//   const taskToDelete = this.selectedTask;
//   const taskName = taskToDelete.name;

//   const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
//     width: '450px',
//     data: { message: `タスク「${taskName}」を削除してもよろしいですか？\nこの操作は取り消せません。\n子タスクがある場合、それらも全て削除されます。` }
//   });

//   dialogRef.afterClosed().subscribe(result => {
//     // console.log('確認ダイアログが閉じられました。結果:', result);
//     if (result === true) { // ダイアログで「削除」が選択された場合
//       // console.log('削除を実行します:', taskToDelete);
      
//       this.projectService.deleteGanttTaskRecursive(taskToDelete.id) // ★ ProjectServiceのメソッド呼び出し
//         .then(() => {
//           // console.log(`タスク「${taskName}」(ID: ${taskToDelete.id}) およびその子タスクがFirestoreから正常に削除されました。`);
          
//           // UI（ローカルのganttTasks配列）を更新
//           this.removeTaskAndChildrenFromLocalList(taskToDelete.id);

//           this.selectedTask = null; // 選択状態をリセット
//           this.cdr.detectChanges();   // UIを更新

//           // ユーザーに成功を通知 (例: Snackbar)
//           // this.snackbar.open(`タスク「${taskName}」を削除しました。`, '閉じる', { duration: 3000 });
//           alert(`タスク「${taskName}」を削除しました。`); // 現状はalert

//         })
//         .catch(error => {
//           // console.error(`タスク「${taskName}」の削除中にエラーが発生しました:`, error);
//           // ユーザーにエラーを通知 (例: Snackbar)
//           // this.snackbar.open(`タスク「${taskName}」の削除に失敗しました。`, '閉じる', { duration: 5000 });
//           alert(`タスク「${taskName}」の削除に失敗しました。エラー: ${error.message || error}`);
//         });
//     } else {
//       // console.log('削除がキャンセルされました。');
//     }
//   });
//  }

 // UI（ローカルのganttTasks配列）からタスクとその子タスクを削除するヘルパーメソッド
 private removeTaskAndChildrenFromLocalList(parentIdToDelete: string): void {
  const tasksToRemove = new Set<string>(); // 削除対象のIDを格納するSet
  
  // 再帰的に削除対象のIDを収集する内部関数
  const collectIdsToDelete = (currentParentId: string) => {
    tasksToRemove.add(currentParentId); // まず親を追加
    const children = this.ganttTasks.filter(task => task.parentId === currentParentId);
    for (const child of children) {
      if (child.id) {
        collectIdsToDelete(child.id); // child.id が string であることが保証される
      } else {
        console.warn('Child task found with undefined ID, skipping recursive delete for this child:', child);
      }
    }
  };

  collectIdsToDelete(parentIdToDelete); // 最初の親IDから収集開始

  // 収集したIDに基づいてローカルリストからタスクを削除
  this.ganttTasks = this.ganttTasks.filter(task => task.id && !tasksToRemove.has(task.id));
}
  

  public logTestClick(task: GanttChartTask | null): void {
    if (task) { 
      this.selectTask(task); 
    }
  }


  // gantt-chart.component.ts の GanttChartComponent クラス内

 // ... (他のメソッドの近くなど) ...


 // ... (クラスの残りの部分)

 isTimestamp(value: unknown): value is Timestamp {
  return !!value && typeof (value as { toDate?: unknown }).toDate === 'function';
 }

// get dueDateForDisplay(): Date | null {
//   return null;
// }


 async onStatusChange(newStatusSelected: 'todo' | 'doing' | 'done', taskId: string, taskItem: GanttChartTask): Promise<void> {
  if (!taskId || !newStatusSelected) {
    console.error('Task IDまたは新しいステータスが不正です。');
    return;
  }

  const originalStatus = taskItem.status;
  const originalProgress = taskItem.progress;

  if (originalStatus === newStatusSelected) {
    // もし進捗率も変更するロジックがここにあるなら、ステータスが同じでも進捗だけ変わるケースを考慮
    // 今回はステータス変更がトリガーなので、ステータスが変わらなければ何もしないで良いでしょう。
    return;
  }

  console.log(`Task ID: ${taskId} のステータスを「${newStatusSelected}」に変更しようとしています。`);

  let newProgressForUpdate: number | null = originalProgress ?? null; // 更新用進捗。現在の進捗を維持が基本
  let statusToUpdate: 'todo' | 'doing' | 'done' = newStatusSelected;

  if (newStatusSelected === 'done') {
    newProgressForUpdate = 100;
  } else if (newStatusSelected === 'todo') {
    newProgressForUpdate = 0;
  } else if (newStatusSelected === 'doing') {
    // 「作業中」に手動で切り替えたときのロジック
    try {
      const dailyLogsObservable = this.taskService.getDailyLogs(taskId);
      const dailyLogs = await firstValueFrom(dailyLogsObservable.pipe(catchError(err => {
        console.error('日次ログの取得中にエラーが発生しました (onStatusChange):', err);
        return of([]); // エラー時は空のログとして扱う
      })));

      if (dailyLogs && dailyLogs.length > 0) {
        const latestLog = dailyLogs[dailyLogs.length - 1]; // getDailyLogsがworkDate昇順ソート済みと仮定
        if (latestLog.progressRate !== null && latestLog.progressRate !== undefined) {
          if (latestLog.progressRate === 100) {
            // 最新ログが100%の場合、ユーザーが手動で'doing'にしようとしても'done'のままにする
            alert('最新の日次ログの進捗が100%のため、ステータスは「完了」のままとなります。');
            statusToUpdate = 'done'; // Firestoreに保存するステータスを'done'に強制
            newProgressForUpdate = 100; // 進捗も100%に強制
          } else {
            newProgressForUpdate = latestLog.progressRate; // 最新ログの進捗率を採用
          }
        } else {
          newProgressForUpdate = 1; // 日次ログはあるが、進捗率が記録されていなければ1%
        }
      } else {
        newProgressForUpdate = 1; // 日次ログがなければ1%
      }
    } catch (error) {
      // このcatchはfirstValueFrom内のエラーハンドリングでカバーされるので、通常ここには来ないはず
      console.error(`Task ID: ${taskId} の日次ログ取得に予期せぬ失敗。進捗は1%として処理します。`, error);
      newProgressForUpdate = 1;
    }
  }

  const updateData: Partial<Task> = {
    status: statusToUpdate,
    updatedAt: serverTimestamp()
  };

  // newProgressForUpdateが数値として有効な場合のみprogressを更新データに含める
  if (typeof newProgressForUpdate === 'number') {
    updateData.progress = newProgressForUpdate;
  }


  // Firestore 更新前の最終確認 (もしステータスも進捗も変わっていなければ更新しない)
  if (originalStatus === statusToUpdate && originalProgress === updateData.progress) {
      console.log('ステータスおよび計算後の進捗に変更がないため、更新をスキップします。');
      // UIのmat-selectの値が意図せず変わってしまっている場合、ここで元の値に戻す必要がある
      if(taskItem.status !== originalStatus) {
          taskItem.status = originalStatus;
          this.cdr.detectChanges();
      }
      return;
  }

  


  try {
    await this.taskService.updateTask(taskId, updateData);
    console.log(`Task ID: ${taskId} のステータスが「${statusToUpdate}」に、進捗が ${updateData.progress !== undefined ? updateData.progress + '%' : '変更なし'} に正常に更新されました。`);

    // ローカルデータの更新
    const taskInList = this.ganttTasks.find(t => t.id === taskId);
    if (taskInList) {
      taskInList.status = statusToUpdate;
      if (updateData.progress !== undefined && typeof updateData.progress === 'number') {
        taskInList.progress = updateData.progress;
      }
      // this.ganttTasks = [...this.ganttTasks]; // 要素のプロパティ変更の場合、これは不要なことが多い
      this.cdr.detectChanges();
    }
  } catch (error) {
    console.error(`Task ID: ${taskId} のステータスまたは進捗更新に失敗しました。`, error);
    alert('タスクのステータス更新に失敗しました。');
    // エラー時はUIを元の状態に戻す
    const taskInList = this.ganttTasks.find(t => t.id === taskId);
    if (taskInList) {
      taskInList.status = originalStatus;
      if (typeof originalProgress === 'number') {
        taskInList.progress = originalProgress;
      }
      this.cdr.detectChanges();
    }
  }
  }

 getToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
 }

 confirmDeleteTask(): void {
  if (!this.selectedTask || !this.selectedTask.id) {
    console.warn('削除対象のタスクが選択されていないか、タスクIDが無効です。');
    alert('削除するタスクを選択してください。');
    return;
  }

  const taskToDelete = this.selectedTask;
  const taskTitle = taskToDelete.title;
  const taskIdToDelete = taskToDelete.id;

  if (confirm(`タスク「${taskTitle}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    console.log('削除を実行します。対象タスクID:', taskIdToDelete);
    this.taskService.deleteGanttChartTask(taskIdToDelete!)
      .then(() => {
        console.log(`タスク (ID: ${taskIdToDelete}) がFirestoreから正常に削除されました。`);
        alert(`タスク「${taskTitle}」を削除しました。`);
        this.ganttTasks = this.ganttTasks.filter(task => task.id !== taskIdToDelete);
        this.selectedTask = null;
        this.cdr.detectChanges();
      })
      .catch(error => {
        console.error(`タスク (ID: ${taskIdToDelete}) の削除中にエラーが発生しました:`, error);
        alert(`タスク「${taskTitle}」の削除に失敗しました。`);
      });
  } else {
    console.log('タスク削除がキャンセルされました。');
  }
}

confirmAndDeleteSimpleTask(): void {
  if (!this.selectedTask || !this.selectedTask.id) {
    alert('削除するタスクを選択してください。');
    return;
  }
  const taskId = this.selectedTask.id;
  const taskTitle = this.selectedTask.title;
  if (confirm(`タスク「${taskTitle}」を削除してもよろしいですか？`)) {
    this.taskService.deleteGanttChartTask(taskId)
      .then(() => {
        alert(`タスク「${taskTitle}」を削除しました。`);
        this.ganttTasks = this.ganttTasks.filter(task => task.id !== taskId);
        this.selectedTask = null;
        this.cdr.detectChanges();
      })
      .catch(error => {
        alert('削除に失敗しました。');
        console.error(error);
      });
  }
}

confirmDeleteNewSimpleTask(taskToDelete: GanttChartTask): void {
  if (!taskToDelete || !taskToDelete.id) {
    alert('削除するタスクの情報が不完全です。');
    return;
  }
  const taskId = taskToDelete.id;
  const taskTitle = taskToDelete.title;

  const dialogRef = this.dialog.open(ConfirmDialogComponent, {
    width: '350px',
    data: { message: `タスク「${taskTitle}」を本当に削除してもよろしいですか？` }
  });

  dialogRef.afterClosed().pipe(
    filter(result => result === true)
  ).subscribe(() => {
    this.taskService.deleteGanttChartTask(taskId)
      .then(() => {
        alert(`タスク「${taskTitle}」を削除しました。`);
        this.ganttTasks = this.ganttTasks.filter(task => task.id !== taskId);
        if (this.selectedTask && this.selectedTask.id === taskId) {
          this.selectedTask = null;
        }
        this.cdr.detectChanges();
      })
      .catch(error => {
        alert(`タスク「${taskTitle}」の削除に失敗しました。`);
        console.error('タスク削除エラー:', error);
      });
  });
}

private calculateTotalTimelineWidth(): void {
  this.totalTimelineWidthPx = this.allDaysInTimeline.length * this.DAY_CELL_WIDTH;
}

getTaskRowHeight(): number {
  return this.TASK_ROW_HEIGHT_PX;
}

getTaskRowTopPosition(index: number): number {
  return index * this.TASK_ROW_HEIGHT_PX;
}

getDate(val: unknown): Date | null {
  if (!val) return null;
  // 型ガードでtoDate関数の存在を判定
  if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: unknown }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  if (val instanceof Date) return val;
  if (typeof val === 'string' && !isNaN(Date.parse(val))) return new Date(val);
  return null;
}

get overallProgressRate(): number | null {
  if (!this.ganttTasks || this.ganttTasks.length === 0) return null;
  const doneCount = this.ganttTasks.filter(t => t.status === 'done').length;
  return Math.round((doneCount / this.ganttTasks.length) * 100);
}

navigateToHome(): void {
  this.router.navigate(['/app/dashboard']);
}

getUserNamesByIds(ids: string[] | undefined): string[] {
  if (!ids) return [];
  return ids.map(id => this.userMap[id]?.displayName || id);
}

}// GanttChartComponent クラスの閉じ括弧





