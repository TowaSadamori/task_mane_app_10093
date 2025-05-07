import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Observable, switchMap, of, filter } from 'rxjs';
import { Task, TaskService, } from '../../../../core/task.service';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TaskFormComponent } from '../../task-form/task-form.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

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
  ],
  templateUrl: './task-detail.component.html',
  styleUrl: './task-detail.component.scss'
})

export class TaskDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);
  private dialog = inject(MatDialog);
  private router = inject(Router);

  task$!: Observable<Task | undefined>
  

  // constructor() {}

  ngOnInit(): void {
    this.task$ = this.route.paramMap.pipe(
      switchMap(params => {
        const taskId = params.get('taskId');
        if (taskId) {
          return this.taskService.getTask(taskId);
        } else {
          return of(undefined);
        }
      })
    )
  }



  openEditDialog(task: Task): void {
    const dialogRef = this.dialog.open(TaskFormComponent,{
      width: '600px',
      data: task,
    });

    dialogRef.afterClosed().subscribe(result => {
      console.log('ダイアログが閉じられました。結果:', result);
      if (result === 'saved') {
        console.log('タスクが更新されたため、データを再読み込みします。');
        this.task$ = this.taskService.getTask(task.id);

      }
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
}
