import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, Timestamp } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { ViewContainerRef } from '@angular/core';
import { GanttDailyLogFormDialogComponent } from '../gantt-daily-log-form-dialog/gantt-daily-log-form-dialog.component';

interface WorkLog {
  id?: string;
  actualBreakTime?: number;
  actualEndTime?: string;
  actualStartTime?: string;
  assigneeId?: string;
  assignees?: string[];
  blockerStatus?: string;
  comment?: string;
  createdAt?: Date | Timestamp | string | undefined;
  photoUrls?: string[];
  progressRate?: number;
  supervisor?: string;
  workDate?: Date | Timestamp | string | undefined;
  workerCount?: number;
  [key: string]: unknown;
}

@Component({
  selector: 'app-gantt-daily-log-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './gantt-daily-log-detail.component.html',
  styleUrl: './gantt-daily-log-detail.component.scss'
})
export class GanttDailyLogDetailComponent implements OnInit {
  ganttTaskId: string | null = null;
  logId: string | null = null;
  workLog: WorkLog | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  private viewContainerRef = inject(ViewContainerRef);

  async ngOnInit() {
    this.ganttTaskId = this.route.snapshot.paramMap.get('ganttTaskId');
    this.logId = this.route.snapshot.paramMap.get('logId');
    if (this.ganttTaskId && this.logId) {
      const logRef = doc(this.firestore, `GanttChartTasks/${this.ganttTaskId}/WorkLogs/${this.logId}`);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) {
        this.workLog = { id: logSnap.id, ...logSnap.data() };
        const taskRef = doc(this.firestore, 'GanttChartTasks', this.ganttTaskId);
        const taskSnap = await getDoc(taskRef);
        if (taskSnap.exists()) {
          const taskData = taskSnap.data();
          this.workLog['taskName'] = taskData['title'] || '';
          // 管理者名取得（プロジェクト経由）
          if (taskData['projectId']) {
            const projectRef = doc(this.firestore, 'Projects', taskData['projectId']);
            const projectSnap = await getDoc(projectRef);
            if (projectSnap.exists()) {
              const projectData = projectSnap.data();
              let managerIds: string[] = [];
              if (Array.isArray(projectData['managerIds'])) {
                managerIds = projectData['managerIds'];
              } else if (projectData['managerId']) {
                managerIds = [projectData['managerId']];
              }
              if (managerIds.length > 0) {
                // UsersコレクションからdisplayName取得
                const usersCol = (await import('@angular/fire/firestore')).collection(this.firestore, 'Users');
                const usersSnap = await (await import('@angular/fire/firestore')).getDocs(usersCol);
                const names: string[] = [];
                usersSnap.forEach(doc => {
                  const data = doc.data();
                  if (
                    (data['id'] && managerIds.includes(data['id'])) ||
                    managerIds.includes(doc.id)
                  ) {
                    if (data['displayName']) names.push(data['displayName']);
                  }
                });
                this.workLog['managerNames'] = names.join(', ');
              } else {
                this.workLog['managerNames'] = '';
              }
            } else {
              this.workLog['managerNames'] = '';
            }
          } else {
            this.workLog['managerNames'] = '';
          }
        }
      }
    }
  }

  goBack() {
    if (this.ganttTaskId) {
      this.router.navigate(['/app/gantt-task-detail', this.ganttTaskId]);
    }
  }

  get formattedWorkDate(): string {
    if (!this.workLog || !this.workLog.workDate) return '-';
    const wd: string | Date | { toDate?: () => Date } = this.workLog.workDate;
    if (typeof wd === 'string') {
      const d = new Date(wd);
      return isNaN(d.getTime()) ? wd : d.toLocaleDateString('ja-JP');
    }
    if (typeof wd === 'object' && wd !== null && 'toDate' in wd && typeof wd.toDate === 'function') {
      return wd.toDate().toLocaleDateString('ja-JP');
    }
    if (wd instanceof Date) {
      return wd.toLocaleDateString('ja-JP');
    }
    return '-';
  }

  openImageDialog(url: string): void {
    window.open(url, '_blank');
  }

  downloadPhoto(url: string): void {
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

  async confirmDelete() {
    const result = window.confirm('本当に削除しますか？');
    if (!result) return;
    // WorkLog削除
    if (this.ganttTaskId && this.logId) {
      const logRef = doc(this.firestore, `GanttChartTasks/${this.ganttTaskId}/WorkLogs/${this.logId}`);
      await (await import('@angular/fire/firestore')).deleteDoc(logRef);
    }
    // タスク詳細画面に戻る
    this.goBack();
  }

  openEditDailyLogDialog(): void {
    if (!this.ganttTaskId || !this.workLog) return;
    const dialogRef = this.dialog.open(GanttDailyLogFormDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      viewContainerRef: this.viewContainerRef,
      data: { ganttTaskId: this.ganttTaskId, log: { ...this.workLog } }
    });
    dialogRef.afterClosed().subscribe(async (result: unknown) => {
      if (result && this.workLog && this.workLog.id) {
        // 編集後は画面をリロード
        window.location.reload();
      }
    });
  }
}
