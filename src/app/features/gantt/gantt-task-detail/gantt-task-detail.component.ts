import { Component, OnInit, inject, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc, DocumentData, deleteDoc } from '@angular/fire/firestore';
import { GanttChartTask } from '../../../core/models/gantt-chart-task.model';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AddTaskDialogComponent } from '../gantt-chart/components/add-task-dialog/add-task-dialog.component';
import { TimestampToDatePipe } from '../../../shared/pipes/timestamp-to-date.pipe';
import { DailyLogFormComponent } from '../../task/daily-log-form/daily-log-form.component';
import { GanttDailyLogFormDialogComponent } from '../gantt-daily-log-form-dialog/gantt-daily-log-form-dialog.component';
import { GanttDailyLogService, GanttDailyLog } from '../gantt-daily-log-form-dialog/gantt-daily-log.service';
import { Observable } from 'rxjs';
import { MatTableModule } from '@angular/material/table';
import { StatusLabelPipe } from '../../../shared/pipes/status-label.pipe';

@Component({
  selector: 'app-gantt-task-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    TimestampToDatePipe,
    MatTableModule,
    StatusLabelPipe
  ],
  templateUrl: './gantt-task-detail.component.html',
  styleUrls: ['./gantt-task-detail.component.scss']
})
export class GanttTaskDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private viewContainerRef = inject(ViewContainerRef);
  private dailyLogService = inject(GanttDailyLogService);

  ganttTaskId: string | null = null;
  ganttTask: GanttChartTask | null = null;
  dailyLogs$!: Observable<GanttDailyLog[]>;
  latestDailyLog: GanttDailyLog | null = null;
  displayedColumns: string[] = [
    'actions',
    'workDate',
    'actualStartTime',
    'actualEndTime',
    'breakTime',
    'progressRate',
    'workerCount',
    'supervisor',
    'comment',
    'photo'
  ];

  async ngOnInit() {
    this.ganttTaskId = this.route.snapshot.paramMap.get('ganttTaskId');
    if (this.ganttTaskId) {
      const docRef = doc(this.firestore, 'GanttChartTasks', this.ganttTaskId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.ganttTask = docSnap.data() as GanttChartTask;
      }
      this.loadDailyLogs();
    }
  }

  loadDailyLogs() {
    if (this.ganttTaskId) {
      this.dailyLogs$ = this.dailyLogService.getDailyLogs(this.ganttTaskId);
      this.dailyLogs$.subscribe(logs => {
        if (logs.length > 0) {
          // updatedAtが最大のものを取得
          this.latestDailyLog = logs.reduce((a, b) =>
            (a.updatedAt?.toMillis?.() || 0) > (b.updatedAt?.toMillis?.() || 0) ? a : b
          );
        } else {
          this.latestDailyLog = null;
        }
      });
    }
  }

  navigateToGanttChart(): void {
    if (this.ganttTask?.projectId) {
      this.router.navigate(['/app/gantt-chart', this.ganttTask.projectId]);
    } else {
      this.router.navigate(['/app/gantt-chart']);
    }
  }

  private removeUndefinedFields(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  }

  openEditDialog(): void {
    if (!this.ganttTask) return;
    const dialogRef = this.dialog.open(AddTaskDialogComponent, {
      width: '500px',
      data: { task: this.ganttTask, isEditMode: true, projectId: this.ganttTask.projectId }
    });

    dialogRef.afterClosed().subscribe(async result => {
      console.log('編集ダイアログから返されたresult:', result);
      if (result && this.ganttTaskId) {
        try {
          const docRef = doc(this.firestore, 'GanttChartTasks', this.ganttTaskId);
          const cleanedResult = this.removeUndefinedFields(result);
          // Firestoreのstatusをそのまま保存・表示する
          await updateDoc(docRef, cleanedResult as DocumentData);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            this.ganttTask = docSnap.data() as GanttChartTask;
          }
        } catch (e) {
          console.error('Firestore updateDocエラー:', e);
        }
      }
    });
  }

  openDailyLogDialog(): void {
    if (!this.ganttTaskId) return;
    this.dialog.open(DailyLogFormComponent, {
      width: '700px',
      data: { taskId: this.ganttTaskId }
    });
  }

  openGanttDailyLogDialog(): void {
    if (!this.ganttTaskId) return;
    const dialogRef = this.dialog.open(GanttDailyLogFormDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      viewContainerRef: this.viewContainerRef,
      data: { ganttTaskId: this.ganttTaskId }
    });
    dialogRef.afterClosed().subscribe(newLog => {
      if (newLog) {
        this.loadDailyLogs();
      }
    });
  }

  openPhotoViewer(photoUrl: string): void {
    // 写真表示機能は現在準備中
    console.log('写真を表示します:', photoUrl);
    window.open(photoUrl, '_blank');
  }

  async deleteDailyLog(logId: string) {
    const confirmed = window.confirm('この日次ログを削除しますか？');
    if (!confirmed) return;
    if (!this.ganttTaskId) return;
    const logRef = doc(this.firestore, `GanttChartTasks/${this.ganttTaskId}/WorkLogs/${logId}`);
    await deleteDoc(logRef);
    this.loadDailyLogs();
  }

  downloadPhoto(url: string) {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const fileName = url.split('?')[0].split('/').pop() || 'downloaded-file';
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      })
      .catch(() => alert('ダウンロードに失敗しました'));
  }

  openEditDailyLogDialog(log: GanttDailyLog): void {
    if (!this.ganttTaskId) return;
    const dialogRef = this.dialog.open(GanttDailyLogFormDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      viewContainerRef: this.viewContainerRef,
      data: { ganttTaskId: this.ganttTaskId, log }
    });
    dialogRef.afterClosed().subscribe(async (result: GanttDailyLog | undefined) => {
      if (result && log.id) {
        try {
          // Firestoreの該当ドキュメントを更新
          const logRef = doc(this.firestore, `GanttChartTasks/${this.ganttTaskId}/WorkLogs/${log.id}`);
          await updateDoc(logRef, result as DocumentData);
          this.loadDailyLogs();
        } catch {
          alert('日次ログの更新に失敗しました');
        }
      }
    });
  }
} 