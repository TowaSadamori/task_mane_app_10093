import { Component, OnInit, inject, ChangeDetectorRef  } from '@angular/core'; // 重複を削除し、OnInit と inject を確実に追加
import { CommonModule } from '@angular/common';
import { Project, ProjectService, GanttTaskDisplayItem, NewGanttTaskData } from '../../../core/project.service'; // パスはユーザー様の環境に合わせてください
import { Timestamp } from '@angular/fire/firestore';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AddTaskDialogComponent } from './components/add-task-dialog/add-task-dialog.component';
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
  ],
  templateUrl: './gantt-chart.component.html',
  styleUrl: './gantt-chart.component.scss'
})


export class GanttChartComponent implements OnInit {
  private projectService = inject(ProjectService);



  constructor(
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ){}

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
    this.generateTimelineHeaders(); // タイムラインヘッダーは先に生成

    // Firestoreからガントタスクを取得して表示する
    this.projectService.getGanttTasks().subscribe({ // ★ subscribe にオブジェクトを渡す形式に変更 (next, error)
      next: (tasks) => {
        this.ganttTasks = tasks;
        console.log('Firestoreからガントタスクを読み込みました:', this.ganttTasks);
        this.cdr.detectChanges(); 
        // 必要であれば、ここでタイムラインの再計算やUIの更新処理をトリガー
      },
      error: (err) => {
        console.error('Firestoreからのガントタスク読み込みに失敗しました:', err);
        // ユーザーへのエラー通知などをここで行う
      }
    });
  }
  
//   private createSampleGanttTasks(): void {
//   const today = new Date();
//   const tomorrow = new Date(today);
//   tomorrow.setDate(today.getDate() + 1);
//   const fiveDaysLater = new Date(today);
//   fiveDaysLater.setDate(today.getDate() + 5);
//   const tenDaysLater = new Date(today);
//   tenDaysLater.setDate(today.getDate() + 10);
//   const sevenDaysLater = new Date(today);
//   sevenDaysLater.setDate(today.getDate() + 7);


//   this.ganttTasks = [
//     { 
//       id: 'task1', name: '親タスク 1', 
//       plannedStartDate: today, 
//       plannedEndDate: tenDaysLater, 
//       level: 0, parentId: null 
//     },
//     { 
//       id: 'task1.1', name: '子タスク 1.1', 
//       plannedStartDate: today, 
//       plannedEndDate: fiveDaysLater, 
//       level: 1, parentId: 'task1' 
//     },
//     { 
//       id: 'task1.1.1', name: '孫タスク 1.1.1', 
//       plannedStartDate: today, 
//       plannedEndDate: tomorrow, 
//       level: 2, parentId: 'task1.1' 
//     },
//     { 
//       id: 'task1.2', name: '子タスク 1.2', 
//       plannedStartDate: fiveDaysLater, 
//       plannedEndDate: tenDaysLater, 
//       level: 1, parentId: 'task1' 
//     },
//     { 
//       id: 'task2', name: '親タスク 2', 
//       plannedStartDate: tomorrow, 
//       plannedEndDate: sevenDaysLater, 
//       level: 0, parentId: null 
//     },
//   ];
//   console.log('Sample Gantt Tasks:', this.ganttTasks);
// }


private mapProjectsToGanttItems(projects: Project[]): GanttTaskDisplayItem[] { // ★ 返り値の型を変更
  return projects.map(project => {
    const ganttItem: GanttTaskDisplayItem = { // ★ 型を変更
      id: project.id,
      name: project.name,
      plannedStartDate: project.startDate instanceof Date
        ? project.startDate
        : (project.startDate instanceof Timestamp
            ? project.startDate.toDate()
            : new Date()), // Date型に
      plannedEndDate: project.endDate instanceof Date
        ? project.endDate
        : (project.endDate instanceof Timestamp
            ? project.endDate.toDate()
            : new Date(new Date().setDate(new Date().getDate() + 7))), // Date型に
      // GanttTaskDisplayItem に合わせて他の必須・オプショナルプロパティのデフォルト値を設定
      status: project.status === 'active' ? '作業中' : (project.status === 'completed' ? '完了' : '未着手'), // 例
      // ... category, wbsNumber, level, parentId など、GanttTaskDisplayItem の他のプロパティも適切に設定
    };
    return ganttItem;
  });
}


  private readonly DAY_CELL_WIDTH = 50; // 1日のセルの幅 (px) 

  

 // ... (DAY_CELL_WIDTH の定義の後)

 getBarLeftPosition(startDate: Date): number { // 引数は Date 型を期待
  console.log('[getBarLeftPosition] timelineStartDate:', this.timelineStartDate, 'taskStartDate:', startDate); // ★デバッグログ追加
  if (!this.timelineStartDate || !startDate || !(startDate instanceof Date)) { // ★ startDate が Date インスタンスか確認
    console.warn('[getBarLeftPosition] Invalid arguments or startDate is not a Date object');
    return 0;
  }
  const diffTime = startDate.getTime() - this.timelineStartDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const leftPosition = Math.max(0, diffDays) * this.DAY_CELL_WIDTH;
  console.log('[getBarLeftPosition] diffDays:', diffDays, 'leftPosition:', leftPosition); // ★デバッグログ追加
  return leftPosition;
}

// ... (getBarLeftPosition の後)

getBarWidth(startDate: Date, endDate: Date): number {
  // 元の日時もログ出力（デバッグに役立つ場合がある）
  console.log('[getBarWidth] original taskStartDate:', startDate, 'original taskEndDate:', endDate);

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
  console.log('[getBarWidth] calculated startDay:', startDay, 'calculated endDay:', endDay);
  console.log('[getBarWidth] durationDays:', durationDays, 'barWidth:', barWidth);
  return barWidth;
}

// ... (openAddTaskDialog メソッドなど)

// ... (openAddTaskDialog メソッドなど)

 openAddTaskDialog(): void {
  const dialogRef = this.dialog.open(AddTaskDialogComponent, {
    width: '400px',
    // data: { ... } // ダイアログに初期値を渡す場合はここ
  });

  

  dialogRef.afterClosed().subscribe(result => {
    // console.log('ダイアログが閉じられました。結果:', result);
    if (result && result.taskName && result.plannedStartDate && result.plannedEndDate) {
      const newTaskToSave: NewGanttTaskData = {
        name: result.taskName,
            plannedStartDate: result.plannedStartDate, // Date オブジェクト
            plannedEndDate: result.plannedEndDate,     // Date オブジェクト
            wbsNumber: (this.ganttTasks.length + 1).toString(),
            category: '未分類',        // または null
            primaryAssigneeId: null,         
            decisionMakerId: null,  
            otherAssigneeIds: [],   
            status: '未着手',          // または null
            actualStartDate: null,
            actualEndDate: null,
            progress: 0,               // または null
            level: 0,                  // または null
            parentId: null,
      };

      this.projectService.addGanttTask(newTaskToSave)
        .then(docRef => {
          console.log('新しいタスクがFirestoreに保存されました。ID:', docRef.id);

          // ★ 画面のタスクリストを更新 (楽観的更新)
          // Firestoreが生成したIDと、クライアントで保持している情報で表示用オブジェクトを作成
          const newTaskForDisplay: GanttTaskDisplayItem = {
            id: docRef.id, // Firestoreが生成したID
            name: newTaskToSave.name,
            plannedStartDate: result.plannedStartDate, 
            plannedEndDate: result.plannedEndDate,
            wbsNumber: newTaskToSave.wbsNumber,
            category: newTaskToSave.category,
            status: newTaskToSave.status,
            progress: newTaskToSave.progress,
            level: newTaskToSave.level,
            parentId: newTaskToSave.parentId,
            // createdAt, updatedAt はFirestoreから読み込む際にセットされるため、ここでは undefined
            // actualStartDate, actualEndDate も最初は null か undefined
          };
          this.ganttTasks = [...this.ganttTasks, newTaskForDisplay];
          console.log('画面のタスクリストに新しいタスクを追加しました:', newTaskForDisplay);
          this.cdr.detectChanges();

        })
        .catch(error => {
          console.error('Firestoreへのタスク保存に失敗しました:', error);
          // ユーザーにエラーを通知する処理などをここに追加 (例: Snackbar)
        });

    } else {
      console.log('ダイアログがキャンセルされたか、無効なデータが渡されました。');
    }
  });
}

  // ★ 新しいタスクのための一意なIDを生成するヘルパーメソッドの例
  private generateUniqueId(): string {
    // 簡単な例: 現在時刻のミリ秒とランダムな数値を組み合わせる
    // より堅牢なUUID生成ライブラリ (例: uuid) の使用も検討できます。
    return `task_${new Date().getTime()}_${Math.floor(Math.random() * 1000)}`;
  }

  openEditTaskDialog(taskToEdit: GanttTaskDisplayItem): void {
    console.log('編集対象のタスク:', taskToEdit);
    // AddTaskDialogComponent を再利用し、編集するタスク情報を data として渡す
    const dialogRef = this.dialog.open(AddTaskDialogComponent, {
      width: '400px',
      data: {
        task: { ...taskToEdit }, // ★ スプレッド構文でオブジェクトのコピーを渡す (元のオブジェクトを直接変更しないため)
        isEditMode: true // ★ 編集モードであることをダイアログに伝えるフラグ (オプション)
      }
    });

    dialogRef.afterClosed().subscribe(result => { // ダイアログが閉じた後の処理
      console.log('編集ダイアログが閉じられました。結果:', result);
      if (result) { // ダイアログから何らかの結果が返ってきた場合 (キャンセルでなければ)
        // result には、ダイアログのフォームで編集されたタスク情報が入っていると期待される
        console.log('更新用データを受け取りました:', result);

        // ★★★ 今後のステップで実装するタスク更新処理の場所 ★★★
        // const taskIdToUpdate = taskToEdit.id; // 更新対象のタスクID (ダイアログに渡した元のタスクのID)
        // this.projectService.updateGanttTask(taskIdToUpdate, result) // result を更新データとして渡す
        //   .then(() => {
        //     console.log('タスクがFirestoreで更新されました。ID:', taskIdToUpdate);
        //     // 画面の this.ganttTasks 配列も更新する
        //     const index = this.ganttTasks.findIndex(task => task.id === taskIdToUpdate);
        //     if (index !== -1) {
        //       // 更新された情報で置き換える (result がそのまま新しいタスク情報か、部分的な更新かによる)
        //       // ここでは result が更新後の全情報を持っていると仮定
        //       this.ganttTasks[index] = { ...this.ganttTasks[index], ...result, id: taskIdToUpdate };
        //       this.ganttTasks = [...this.ganttTasks]; // 変更検知のため新しい参照に
        //       this.cdr.detectChanges();
        //       console.log('画面のタスクリストを更新しました。');
        //     }
        //   })
        //   .catch(error => {
        //     console.error('Firestoreのタスク更新に失敗しました:', error);
        //   });
      } else {
        console.log('編集ダイアログがキャンセルされたか、データがありませんでした。');
      }
    }); // subscribe の閉じ括弧
  } // openEditTaskDialog メソッドの閉じ括弧

// ... (クラスの残りの部分)
} // GanttChartComponent クラスの閉じ括弧





