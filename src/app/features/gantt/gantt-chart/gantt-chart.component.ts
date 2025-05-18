import { Component, OnInit, inject, ChangeDetectorRef, ElementRef } from '@angular/core';
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
import { firstValueFrom, of, Observable,  } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators'; // catchError を追加
import { GanttChartTask } from '../../../core/models/gantt-chart-task.model'; 


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

  project$: Observable<Project | undefined> | undefined;
  tasks$: Observable<GanttTaskDisplayItem[]> | undefined;
  projectId: string | null = null;
  isLoadingProject = true;
  isLoadingTasks = true;
  projectError: string | null = null;
  tasksError: string | null = null;
  selectedTask: GanttTaskDisplayItem | null = null;
  private el: ElementRef<HTMLElement> = inject(ElementRef);


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
    console.log('Generated Timeline Years:', this.timelineYears);
    console.log('Generated All Days:', this.allDaysInTimeline);
  }

  ganttTasks: GanttTaskDisplayItem[] = [];

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
      next: project => {
        this.project$ = of(project); // Observable<Project | undefined> に変換
        this.isLoadingProject = false;
        if (!project && this.projectId) { // projectIdはあるがプロジェクトが見つからない場合
          this.projectError = `プロジェクト (ID: ${this.projectId}) が見つかりません。`;
        }
      },
      error: err => {
        console.error('プロジェクト情報の取得エラー:', err);
        this.projectError = 'プロジェクト情報の取得中にエラーが発生しました。';
        this.isLoadingProject = false;
      }
    });
  }

  loadTasksForProject(projectId: string): void {
    console.log('GanttChartComponent: Loading tasks for project ID:', projectId);
    this.isLoadingTasks = true;
    this.tasksError = null;
    this.tasks$ = this.projectService.getGanttTasksForProject(projectId).pipe(
      tap(tasks => {
        this.ganttTasks = tasks; // ローカル配列にも保存
        this.isLoadingTasks = false;
        console.log(`Tasks for project ${projectId}:`, tasks);
        if (tasks.length > 0) {
          // タスクの日付範囲からタイムラインの開始日・終了日を決定する場合など
          // this.updateTimelineRangeBasedOnTasks(tasks); // ← 将来的に実装
          this.generateTimelineHeaders(); // ★ タスク取得後にタイムライン生成
        } else {
          this.timelineYears = []; // タスクがない場合はタイムラインもクリア
          this.allDaysInTimeline = [];
        }
        this.cdr.detectChanges();
      }),
      catchError(err => {
        console.error(`Error fetching tasks for project ${projectId}:`, err);
        this.tasksError = `タスクの取得中にエラーが発生しました。`;
        this.isLoadingTasks = false;
        this.ganttTasks = [];
        this.timelineYears = [];
        this.allDaysInTimeline = [];
        this.cdr.detectChanges();
        return of([]);
      })
    );
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


  private readonly DAY_CELL_WIDTH = 50; // 1日のセルの幅 (px) 

  

 // ... (DAY_CELL_WIDTH の定義の後)

 getBarLeftPosition(startDate: Date): number { // 引数は Date 型を期待
  // console.log('[getBarLeftPosition] timelineStartDate:', this.timelineStartDate, 'taskStartDate:', startDate); // ★デバッグログ追加
  if (!this.timelineStartDate || !startDate || !(startDate instanceof Date)) { // ★ startDate が Date インスタンスか確認
    // console.warn('[getBarLeftPosition] Invalid arguments or startDate is not a Date object');
    return 0;
  }
  const diffTime = startDate.getTime() - this.timelineStartDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const leftPosition = Math.max(0, diffDays) * this.DAY_CELL_WIDTH;
  // console.log('[getBarLeftPosition] diffDays:', diffDays, 'leftPosition:', leftPosition); // ★デバッグログ追加
  return leftPosition;
}

// ... (getBarLeftPosition の後)

getBarWidth(startDate: Date, endDate: Date): number {
  // 元の日時もログ出力（デバッグに役立つ場合がある）
  // console.log('[getBarWidth] original taskStartDate:', startDate, 'original taskEndDate:', endDate);

  if (!startDate || !endDate || !(startDate instanceof Date) || !(endDate instanceof Date) || endDate < startDate) {
    console.warn('[getBarWidth] Invalid arguments or dates are not Date objects or endDate is before startDate');
    return 0;
  }

  // 時刻部分をリセットして日付のみで期間を計算
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  // 期間の日数計算 (ミリ秒差を日数に変換し、+1することで開始日と終了日を含む日数を算出)
  const durationDays = Math.round((endDay.getTime() - startDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;


  const barWidth = durationDays * this.DAY_CELL_WIDTH;
  // console.log('[getBarWidth] calculated startDay:', startDay, 'calculated endDay:', endDay);
  // console.log('[getBarWidth] durationDays:', durationDays, 'barWidth:', barWidth);
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
    console.error('プロジェクトIDが設定されていません。タスク追加ダイアログを開けません。');
    alert('エラー: プロジェクトが選択されていません。先にプロジェクトを選択するか、管理者に問い合わせてください。');
    return;
  }
  const dialogRef = this.dialog.open(AddTaskDialogComponent, {
    width: '400px',
    data: {
      isEditMode: false,
      task: null,
      projectId: this.projectId
    }
  });

  dialogRef.afterClosed().subscribe(result => {
    console.log('タスク追加ダイアログが閉じられました。結果:', result);

    // ▼▼▼ 一旦、既存の処理をコメントアウト ▼▼▼
    /*
    if (result && result.taskName && result.plannedStartDate && result.plannedEndDate && result.assigneeId) {
      // ... (ここから元の長い処理が続く) ...
      // ... this.projectService.addGanttTask(newTaskToSave) ...
      // ... this.taskService.addDailyLog(...) ...
      // ... this.ganttTasks = [...this.ganttTasks, newTaskForDisplay]; ...
    } else {
      console.log('ダイアログがキャンセルされたか、必須データ(taskName, dates, assigneeId)が不足しています。');
    }
    */

    // ▼▼▼ 新しいシンプルな保存処理をここに記述 ▼▼▼
    if (result && result.taskName && result.plannedStartDate && result.plannedEndDate) {
      // result.taskName, result.plannedStartDate, result.plannedEndDate は
      // AddTaskDialogComponent の taskForm のコントロール名に合わせてください。

      if (!this.projectId) {
        console.error('プロジェクトIDが予期せずnullになりました。新しいタスクを作成できません。');
        alert('エラー: プロジェクト情報が失われました。再度操作をお試しください。');
        return;
      }

      const newSimpleGanttTask: Omit<GanttChartTask, 'id' | 'createdAt'> = {
        projectId: this.projectId,
        title: result.taskName,
        plannedStartDate: Timestamp.fromDate(new Date(result.plannedStartDate)),
        plannedEndDate: Timestamp.fromDate(new Date(result.plannedEndDate)),
      };

      console.log('Firestore ("GanttChartTasks") に保存するシンプルなデータ:', newSimpleGanttTask);

      this.taskService.addGanttChartTask(newSimpleGanttTask) // TaskServiceの新しいメソッド
        .then(docRef => {
          console.log('新しいシンプルなGanttChartTaskが "GanttChartTasks" コレクションに保存されました。ID:', docRef.id);
          alert(`タスク「${newSimpleGanttTask.title}」が新しいコレクションに追加されました。(表示は次のステップ)`);

          // ここで画面を更新する処理は、まず保存が成功することを確認してから追加しましょう。
          // (例: this.loadNewGanttChartTasks(); のようなメソッドを後で作成)
        })
        .catch(error => {
          console.error('シンプルなGanttChartTaskの保存中にエラーが発生しました:', error);
          alert('タスクの追加（シンプル版）に失敗しました。詳細はコンソールを確認してください。');
        });

    } else {
      console.log('タスク追加（シンプル版）がキャンセルされたか、必須データ(taskName, plannedStartDate, plannedEndDate)が不足しています。');
    }
  });
}

public trackByTaskId(index: number, taskItem: GanttTaskDisplayItem): string { // taskItemの型は適切に設定してください
  return taskItem && taskItem.id ? taskItem.id : index.toString();
}

// openAddTaskDialog(): void {
//   // ↓ this.currentProjectId を this.projectId に変更
//   if (!this.projectId) {
//     console.error('プロジェクトIDが設定されていません。タスク追加ダイアログを開けません。');
//     alert('エラー: プロジェクトが選択されていません。先にプロジェクトを選択するか、管理者に問い合わせてください。');
//     return; // projectId がないので処理を中断
//   }
//   const dialogRef = this.dialog.open(AddTaskDialogComponent, {
//     width: '400px',
//     data: {
//       isEditMode: false,
//       task: null,
//       // ↓ this.currentProjectId を this.projectId に変更
//       projectId: this.projectId // ★ 現在のプロジェクトID (this.projectId) を渡す
//     }
//   });

  

//   dialogRef.afterClosed().subscribe(result => {
//     console.log('ダイアログが閉じられました。結果:', result);
//     // ▼▼▼ ステップAの修正 ▼▼▼
//     if (result && result.taskName && result.plannedStartDate && result.plannedEndDate && result.assigneeId) {
//       // ▼▼▼ ステップBの修正 ▼▼▼

//       if (!this.projectId) {
//         console.error('プロジェクトIDが予期せずnullになりました。タスクを作成できません。');
//         alert('エラー: プロジェクト情報が失われました。再度操作をお試しください。');
//         return;
//       }

//       const newTaskToSave: NewGanttTaskData = {
//         title: result.taskName,
//         plannedStartDate: result.plannedStartDate,
//         plannedEndDate: result.plannedEndDate,
//         assigneeId: result.assigneeId,
//         dueDate: result.dueDate instanceof Date
//           ? result.dueDate
//           : (result.dueDate && typeof (result.dueDate as Timestamp).toDate === 'function')
//             ? (result.dueDate as Timestamp).toDate()
//             : null,
//         category: result.category || null,
//         decisionMakerId: result.decisionMakerId || null,
//         projectId: this.projectId,
//         status: 'todo',
//         level: 0,
//         parentId: null,
//         wbsNumber: (this.ganttTasks.length + 1).toString(),
//         otherAssigneeIds: [],
//         blockerStatus: null,
//         actualStartDate: null,
//         actualEndDate: null,
//         progress: 0,
//       };

//       console.log('作成するnewTaskToSaveオブジェクト (gantt-chart.component):', newTaskToSave);

//       this.projectService.addGanttTask(newTaskToSave)
//         .then(ganttTaskDocRef => {
//           console.log('新しいガントタスク(Task)がFirestoreに保存されました。ID:', ganttTaskDocRef.id);

//           const newDailyLogEntry: NewDailyLogData = {
//             workDate: Timestamp.fromDate(new Date()),
//             reporterId: 'SYSTEM_AUTO_GENERATED',
//             progressRate: 0,
//             comment: `ガントチャートタスク「${newTaskToSave.title}」から自動生成されたToDoエントリ`,
//             ganttTaskId: ganttTaskDocRef.id,
//             plannedStartTime: newTaskToSave.plannedStartDate instanceof Date
//                               ? Timestamp.fromDate(newTaskToSave.plannedStartDate)
//                               : newTaskToSave.plannedStartDate, // Timestampの可能性も考慮
//             plannedEndTime: newTaskToSave.plannedEndDate instanceof Date
//                             ? Timestamp.fromDate(newTaskToSave.plannedEndDate)
//                             : newTaskToSave.plannedEndDate, // Timestampの可能性も考慮
//           };

//           if (ganttTaskDocRef.id) {
//             this.taskService.addDailyLog(ganttTaskDocRef.id, newDailyLogEntry)
//               .then(dailyLogDocRef => {
//                 console.log(`自動生成されたDailyLogがFirestoreに保存されました。DailyLog ID: ${dailyLogDocRef.id}, 関連付けられたTask ID: ${ganttTaskDocRef.id}`);
//               })
//               .catch(dailyLogError => {
//                 console.error('自動生成されたDailyLogのFirestoreへの保存に失敗しました:', dailyLogError);
//                 alert('自動生成されたToDoの保存に失敗しました。詳細はコンソールを確認してください。');
//               });
//           } else {
//             console.error('Task ID (ganttTaskDocRef.id) が見つかりません。DailyLogを紐付けることができませんでした。');
//             alert('ガントタスクのIDが見つからないため、自動生成されたToDoを紐付けることができませんでした。');
//           }

//           // 画面表示用のnewTaskForDisplay作成は次の提案で調整します
//           // ... (現在のnewTaskForDisplay作成と画面更新ロジック) ...
//           const newTaskForDisplay: GanttTaskDisplayItem = {
//             id: ganttTaskDocRef.id,
//             name: newTaskToSave.title,
//             title: newTaskToSave.title,
//             projectId: newTaskToSave.projectId,
//             assigneeId: newTaskToSave.assigneeId,
//             status: newTaskToSave.status as 'todo' | 'doing' | 'done',
//             dueDate: newTaskToSave.dueDate instanceof Date
//               ? newTaskToSave.dueDate
//               : (newTaskToSave.dueDate && typeof (newTaskToSave.dueDate as Timestamp).toDate === 'function')
//                 ? (newTaskToSave.dueDate as Timestamp).toDate()
//                 : null,
//             createdAt: new Date(),
//             plannedStartDate: newTaskToSave.plannedStartDate instanceof Date
//               ? newTaskToSave.plannedStartDate
//               : (newTaskToSave.plannedStartDate && typeof (newTaskToSave.plannedStartDate as Timestamp).toDate === 'function')
//                 ? (newTaskToSave.plannedStartDate as Timestamp).toDate()
//                 : null,
//             plannedEndDate: newTaskToSave.plannedEndDate instanceof Date
//               ? newTaskToSave.plannedEndDate
//               : (newTaskToSave.plannedEndDate && typeof (newTaskToSave.plannedEndDate as Timestamp).toDate === 'function')
//                 ? (newTaskToSave.plannedEndDate as Timestamp).toDate()
//                 : null,
//             level: newTaskToSave.level,
//             parentId: newTaskToSave.parentId,
//             wbsNumber: newTaskToSave.wbsNumber,
//             category: newTaskToSave.category,
//             otherAssigneeIds: newTaskToSave.otherAssigneeIds || [],
//             decisionMakerId: newTaskToSave.decisionMakerId,
//             blockerStatus: newTaskToSave.blockerStatus,
//             actualStartDate: null,
//             actualEndDate: null,
//             progress: newTaskToSave.progress,
//             // ganttItemId や updatedAt は GanttTaskDisplayItem の型定義に含まれていれば、
//             // 必要に応じて newTaskToSave から、または固定値で設定します。
//             // ganttItemId: ganttTaskDocRef.id, // 例
//             // updatedAt: new Date(), // 例
//           };
//           this.ganttTasks = [...this.ganttTasks, newTaskForDisplay];
//           this.cdr.detectChanges();

//         })
//         .catch(error => {
//           console.error('Firestoreへのガントタスク(Task)保存に失敗しました:', error);
//         });
//     } else {
//       console.log('ダイアログがキャンセルされたか、必須データ(taskName, dates, assigneeId)が不足しています。');
//     }
//   });
//  }

//   // ★ 新しいタスクのための一意なIDを生成するヘルパーメソッドの例
//   private generateUniqueId(): string {
//     // 簡単な例: 現在時刻のミリ秒とランダムな数値を組み合わせる
//     // より堅牢なUUID生成ライブラリ (例: uuid) の使用も検討できます。
//     return `task_${new Date().getTime()}_${Math.floor(Math.random() * 1000)}`;
//   }

//   openEditTaskDialog(taskToEdit: GanttTaskDisplayItem): void {
//     console.log('編集対象のタスク:', taskToEdit);
//     // AddTaskDialogComponent を再利用し、編集するタスク情報を data として渡す
//     const dialogRef = this.dialog.open(AddTaskDialogComponent, {
//       width: '400px',
//       data: {
//         task: { ...taskToEdit }, // ★ スプレッド構文でオブジェクトのコピーを渡す (元のオブジェクトを直接変更しないため)
//         isEditMode: true // ★ 編集モードであることをダイアログに伝えるフラグ (オプション)
//       }
//     });


//     dialogRef.afterClosed().subscribe(result => { // ダイアログが閉じた後の処理
//       console.log('編集ダイアログが閉じられました。結果:', result);
//       if (result) { // ダイアログから何らかの結果が返ってきた場合 (キャンセルでなければ)
//         // result には、ダイアログのフォームで編集されたタスク情報が入っていると期待される
//         console.log('更新用データを受け取りました:', result);

//         const taskIdToUpdate = taskToEdit.id; // 更新対象のタスクID (ダイアログに渡した元のタスクのID)
//         this.projectService.updateGanttTask(taskIdToUpdate, result) // result を更新データとして渡す
//           .then(() => {
//             console.log('タスクがFirestoreで更新されました。ID:', taskIdToUpdate);
//             // 画面の this.ganttTasks 配列も更新する
//             const index = this.ganttTasks.findIndex(task => task.id === taskIdToUpdate);
//             if (index !== -1) {
//               // 更新された情報で置き換える (result がそのまま新しいタスク情報か、部分的な更新かによる)
//               // ここでは result が更新後の全情報を持っていると仮定
//               this.ganttTasks[index] = { ...this.ganttTasks[index], ...result, id: taskIdToUpdate };
//               this.ganttTasks = [...this.ganttTasks]; // 変更検知のため新しい参照に
//               this.cdr.detectChanges();
//               console.log('画面のタスクリストを更新しました。');
//             }
//           })
//           .catch(error => {
//             console.error('Firestoreのタスク更新に失敗しました:', error);
//           });
//       } else {
//         console.log('編集ダイアログがキャンセルされたか、データがありませんでした。');
//       }
//     }); // subscribe の閉じ括弧
//   } // openEditTaskDialog メソッドの閉じ括弧

//     // ... (openEditTaskDialog メソッドの後など、クラス内の適切な場所) ...

//     public trackByTaskId(index: number, taskItem: GanttTaskDisplayItem): string {
//       return taskItem.id;
//     }

    selectTask(task: GanttTaskDisplayItem): void {
      // console.log(`%cselectTask CALLED with task: ${task.name} (ID: ${task.id})`, 'color: blue; font-weight: bold;');
    
      const isCurrentlySelected = this.selectedTask && this.selectedTask.id === task.id;
      // console.log(`  - Currently selected task ID: ${this.selectedTask ? this.selectedTask.id : 'null'}`);
      // console.log(`  - Clicked task ID: ${task.id}`);
      // console.log(`  - Is this task currently selected (this.selectedTask.id === task.id)?: ${isCurrentlySelected}`);
    
      if (isCurrentlySelected) {
        // console.log('  - DESELECTING task...');
        this.selectedTask = null;
        // console.log('  - AFTER DESELECT: this.selectedTask is now:', this.selectedTask);
        this.cdr.detectChanges(); // ★★★ 選択解除直後に変更検知 ★★★
        // console.log('  - detectChanges called immediately after setting selectedTask to null');
        
        const clickedRowElement = this.el.nativeElement.querySelector('#task-row-' + task.id) as HTMLElement | null; // HTMLElementにキャスト
      if (clickedRowElement && typeof clickedRowElement.blur === 'function') {
        clickedRowElement.blur();
        // console.log(`Blurred element: #task-row-${task.id}`);
      }

      } else {
        // console.log('  - SELECTING task...');
        this.selectedTask = task;
        // console.log('  - AFTER SELECT: this.selectedTask is now:', this.selectedTask);
        this.cdr.detectChanges(); 
      }
    
      if (this.selectedTask) {
        console.log(`  - For [ngClass] evaluation (after update): current this.selectedTask.id = '${this.selectedTask.id}' (type: ${typeof this.selectedTask.id})`);
      } else {
        console.log('  - For [ngClass] evaluation (after update): this.selectedTask is null. All rows should be unselected.');
      }
    
      this.cdr.detectChanges(); // ★★★ メソッドの最後に再度変更検知 ★★★
      console.log('%cselectTask FINISHED and final detectChanges called', 'color: blue; font-weight: bold;');
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
      collectIdsToDelete(child.id); // 子に対して再帰呼び出し
    }
  };

  collectIdsToDelete(parentIdToDelete); // 最初の親IDから収集開始

  // 収集したIDに基づいてローカルリストからタスクを削除
  this.ganttTasks = this.ganttTasks.filter(task => !tasksToRemove.has(task.id));
  console.log('ローカルのタスクリストから削除対象をフィルタリングしました。残りのタスク数:', this.ganttTasks.length);
 }
  

  public logTestClick(task: GanttTaskDisplayItem | null): void {

    // const taskName = task ? task.name : 'Unknown or Null Task';
    // const taskId = task ? task.id : 'N/A';
    // alert(`DEBUG: logTestClick - Step 1\nTask Name: ${taskName}\nTask ID: ${taskId}`); 
  
     if (task) { 
       this.selectTask(task); 
     }

    // alert('DEBUG: logTestClick - Step 2: Reached end of method.'); 
  }


  // gantt-chart.component.ts の GanttChartComponent クラス内

 // ... (他のメソッドの近くなど) ...


 // ... (クラスの残りの部分)

 isTimestamp(obj: unknown): obj is { toDate: () => Date } {
  return !!obj && typeof (obj as { toDate?: unknown }).toDate === 'function';
 }

 get dueDateForDisplay(): Date | null {
  const dueDate = this.selectedTask?.dueDate;
  if (!dueDate) return null;
  if (typeof (dueDate as unknown as { toDate?: unknown }).toDate === 'function') {
    return (dueDate as unknown as { toDate: () => Date }).toDate();
  }
  return dueDate as Date;
 }


 async onStatusChange(newStatusSelected: 'todo' | 'doing' | 'done', taskId: string, taskItem: GanttTaskDisplayItem): Promise<void> {
  if (!taskId || !newStatusSelected) {
    console.error('Task IDまたは新しいステータスが不正です。');
    return;
  }

  const originalStatus = taskItem.status;
  const originalProgress = taskItem.progress;

  if (originalStatus === newStatusSelected) {
    // もし進捗率も変更するロジックがここにあるなら、ステータスが同じでも進捗だけ変わるケースを考慮
    // 今回はステータス変更がトリガーなので、ステータスが変わらなければ何もしないで良いでしょう。
    console.log('ステータスに変更はありません。');
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

}// GanttChartComponent クラスの閉じ括弧





