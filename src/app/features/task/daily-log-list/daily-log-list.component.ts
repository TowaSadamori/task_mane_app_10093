import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TaskService, DailyLog } from '../../../core/task.service';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { GanttChartTask } from '../../../core/models/gantt-chart-task.model';

@Component({
  selector: 'app-daily-log-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatTableModule, MatIconModule],
  templateUrl: './daily-log-list.component.html',
  styleUrls: ['./daily-log-list.component.scss'],
})
export class DailyLogListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private taskService = inject(TaskService);
  private router = inject(Router);

  taskId: string | null = null;
  dailyLogs$!: Observable<DailyLog[]>;
  readonly columns: string[] = ['workDate', 'progressRate', 'workerCount', 'supervisor', 'comment', 'photo'];

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.taskId = params.get('taskId');
      if (this.taskId) {
        this.dailyLogs$ = this.taskService.getDailyLogs(this.taskId);
      }
    });
  }

  onAddLog(): void {
    // ここでフォームを開く（後で実装）
    alert('日次ログ追加フォームを開く（未実装）');
  }

  navigateToGanttChart(): void {
    // 戻る（ガントチャート）
    window.history.back();
  }

  goToDailyLog(task: { id: string; title: string }): void {
    if (task && task.id) {
      this.router.navigate(['/app/daily-log', task.id]);
    }
  }

  goToGanttTaskDetail(task: GanttChartTask): void {
    this.router.navigate(['/app/gantt-task-detail', task.id]);
  }
} 