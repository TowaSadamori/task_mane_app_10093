import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Observable, switchMap, of, filter } from 'rxjs';
import {  TaskService, DailyLog, TaskDisplay } from '../../../../core/task.service';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TaskFormComponent } from '../../task-form/task-form.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { DailyLogFormComponent } from '../../daily-log-form/daily-log-form.component';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatDialogModule,
    // TaskFormComponent,
    // ConfirmDialogComponent,
    MatTableModule,
    MatIconModule,
    // DailyLogFormComponent,
    MatSelectModule,
    MatFormFieldModule,
  ],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.scss'
})



export class TaskDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  task$!: Observable<TaskDisplay | undefined>;
  projectId: string | null = null;
  // isEditing = false;

  openDailyLogForm(taskId: string, log?: DailyLog): void {
    if (!taskId) {
      console.error('タスクIDが不明なため、日次ログフォームを開けません。');
      return;
    }

    console.log('日次ログフォームを開きます。 TaskId:', taskId, '編集対象:', log);
    const dialogRef = this.dialog.open(DailyLogFormComponent, {
      width: '700px',
      data: {
        taskId: taskId,
        initialData: log ?? null,
      },

      disableClose: true,

    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('日次ダイアログが閉じられました。結果:', result);
      if (result === 'saved') {
        console.log('日次ログが保存/更新されたため、ログリストを更新します。');
      }
    })
  }

  dailyLogs$!: Observable<DailyLog[]>;
  readonly dailyLogColumns: string[] = ['workDate', 'actualTime', 'progressRate', 'workerCount', 'supervisor', 'comment','photo'];



  // constructor() {}

  ngOnInit(): void {
    this.task$ = this.route.paramMap.pipe(
      switchMap(params => {
        const taskId = params.get('taskId');
        if (taskId) {
          this.taskService.getTask(taskId).subscribe(task => {
            if (task && task.projectId) {
              this.projectId = task.projectId;
            }
          });
          this._loadDailyLogs(taskId);
          return this.taskService.getTask(taskId);
        } else {
          return of(undefined);
        }
      })
    );
  }

  private _loadDailyLogs(taskId: string): void {
    this.dailyLogs$ = this.taskService.getDailyLogs(taskId);
  }


  openEditDialog(task: TaskDisplay): void {
    const dialogRef = this.dialog.open(TaskFormComponent,{
      width: '600px',
      data: task, // TaskDisplay 型の task を渡す
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('ダイアログが閉じられました。結果:', result);
      if (result === 'saved') {
        console.log('タスクが更新されたため、データを再読み込みします。');
        this.task$ = this.taskService.getTask(task.id);

      }
    })
  }

  onBlockerChange(newStatus: string | null, taskId: string): void {
    if (!taskId) {
      console.error('Task ID is missing in onBlockerChange');
      alert('エラー:タスクIDが見つからないため、ブロッカー状況を更新できません。');
      return;
    }
    console.log(`タスク ${taskId} のブロッカー状況を '${newStatus}' に変更します...`);

    this.taskService.updateTaskBlockerStatus(taskId, newStatus)
    .then(() =>{
      console.log(`タスク ${taskId} のブロッカー状況を正常に更新しました。`);
    })
    .catch(error => {
      console.error('ブロッカー状況の更新に失敗しました:', error);
      alert(`ブロッカー状況の更新中にエラーが発生しました。\n${error.message || ''}`);
    })
  }



  deleteTask(taskId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',

    });

    dialogRef.afterClosed().pipe(
      filter(result => result === true),
      switchMap(() => {
        console.log('削除を実行します:ID:', taskId);
        return this.taskService.deleteTask(taskId);
      })
    ).subscribe({
      next: () => {
      console.log('タスク削除成功:ID', taskId);
      alert('タスクの削除しました。');
      this.router.navigate(['/app/tasks']);
    },
  error: (error) => {
    console.error('タスク削除失敗:', error);
    alert('タスクの削除に失敗しました。');
  }
  });
  }


   openPhotoViewer(photoUrl: string): void {
    console.log('Attempting to open photo viewer for URL:', photoUrl);
    alert('写真表示機能は現在準備中です。\nURL: ' + photoUrl);}

  navigateToGanttChart(): void {
    if (this.projectId) {
      this.router.navigate(['/app/gantt-chart', this.projectId]);
    } else {
      this.router.navigate(['/app/gantt-chart']);
    }
  }
}

