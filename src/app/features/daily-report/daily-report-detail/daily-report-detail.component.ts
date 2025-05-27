import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collectionGroup, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GanttDailyLogFormDialogComponent } from '../../gantt/gantt-daily-log-form-dialog/gantt-daily-log-form-dialog.component';
import { GanttDailyLogService, GanttDailyLog } from '../../gantt/gantt-daily-log-form-dialog/gantt-daily-log.service';
import { RouterModule } from '@angular/router';

interface WorkLog {
  workDate?: { toDate: () => Date };
  supervisor?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualBreakTime?: number;
  progressRate?: number;
  workerCount?: number;
  comment?: string;
  photoUrls?: string[];
  [key: string]: unknown;
}

@Component({
  selector: 'app-daily-report-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterModule],
  templateUrl: './daily-report-detail.component.html',
  styleUrl: './daily-report-detail.component.scss'
})
export class DailyReportDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  private dailyLogService = inject(GanttDailyLogService);

  dailyReportId: string | null = null;
  ganttTaskId: string | null = null;
  workLog: WorkLog | null = null;
  taskName: string | null = null;
  managerNames: string | null = null;
  dailyReport: Record<string, unknown> | null = null;

  async ngOnInit() {
    this.dailyReportId = this.route.snapshot.paramMap.get('dailyReportId');
    if (this.dailyReportId) {
      // dailyReportsコレクションから取得
      const docRef = doc(this.firestore, 'dailyReports', this.dailyReportId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.dailyReport = docSnap.data();
      }
      // コレクショングループクエリでWorkLogsからganttTaskIdとWorkLogデータを取得
      const q = query(
        collectionGroup(this.firestore, 'WorkLogs'),
        where('id', '==', this.dailyReportId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        // パス例: GanttChartTasks/{ganttTaskId}/WorkLogs/{logId}
        const pathSegments = docSnap.ref.path.split('/');
        this.ganttTaskId = pathSegments[1];
        this.workLog = docSnap.data() as WorkLog;
        // タスク名取得とプロジェクトID取得
        const taskDocSnap = await (await import('@angular/fire/firestore')).getDoc(
          (await import('@angular/fire/firestore')).doc(this.firestore, 'GanttChartTasks', this.ganttTaskId)
        );
        if (taskDocSnap.exists()) {
          const taskData = taskDocSnap.data() as { title?: string, projectId?: string };
          this.taskName = taskData.title || null;
          // プロジェクトの管理者名取得
          if (taskData.projectId) {
            const projectDocSnap = await (await import('@angular/fire/firestore')).getDoc(
              (await import('@angular/fire/firestore')).doc(this.firestore, 'Projects', taskData.projectId)
            );
            if (projectDocSnap.exists()) {
              const projectData = projectDocSnap.data() as { managerIds?: string[], managerId?: string };
              let managerIds: string[] = [];
              if (Array.isArray(projectData.managerIds)) {
                managerIds = projectData.managerIds;
              } else if (projectData.managerId) {
                managerIds = [projectData.managerId];
              }
              if (managerIds.length > 0) {
                // UsersコレクションからdisplayName取得（idフィールドまたはドキュメントIDで比較）
                const usersSnap = await (await import('@angular/fire/firestore')).getDocs(
                  (await import('@angular/fire/firestore')).collection(this.firestore, 'Users')
                );
                const names: string[] = [];
                usersSnap.forEach(doc => {
                  const data = doc.data() as { displayName?: string, id?: string };
                  if (
                    (data.id && managerIds.includes(data.id)) ||
                    managerIds.includes(doc.id)
                  ) {
                    if (data.displayName) names.push(data.displayName);
                  }
                });
                this.managerNames = names.join(', ');
              }
            }
          }
        }
      }
    }
  }

  navigateToTaskDetail() {
    if (this.ganttTaskId) {
      this.router.navigate(['/app/gantt-task-detail', this.ganttTaskId]);
    }
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

  async editDailyLog() {
    if (!this.ganttTaskId || !this.workLog) return;
    const dialogRef = this.dialog.open(GanttDailyLogFormDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      data: { ganttTaskId: this.ganttTaskId, log: { ...this.workLog, id: this.dailyReportId } as GanttDailyLog }
    });
    dialogRef.afterClosed().subscribe(async (result: GanttDailyLog | undefined) => {
      if (result) {
        // 編集後は再取得
        await this.reloadWorkLog();
      }
    });
  }

  private async reloadWorkLog() {
    if (!this.dailyReportId) return;
    const q = query(
      collectionGroup(this.firestore, 'WorkLogs'),
      where('id', '==', this.dailyReportId)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const pathSegments = docSnap.ref.path.split('/');
      this.ganttTaskId = pathSegments[1];
      this.workLog = docSnap.data() as WorkLog;
    }
  }

  async deleteDailyLog() {
    if (!this.ganttTaskId || !this.dailyReportId) return;
    const confirmed = window.confirm('この日次ログを削除しますか？');
    if (!confirmed) return;
    // Firestoreから削除
    const logRefPath = `GanttChartTasks/${this.ganttTaskId}/WorkLogs/${this.dailyReportId}`;
    const logRef = (await import('@angular/fire/firestore')).doc(this.firestore, logRefPath);
    await (await import('@angular/fire/firestore')).deleteDoc(logRef);
    // タスク詳細画面に戻る
    this.navigateToTaskDetail();
  }

  // Add this method for template date formatting
  public formatWorkDate(value: unknown): string {
    let date: Date | null = null;
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
      date = (value as { toDate: () => Date }).toDate();
    } else if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) date = d;
    }
    if (!date) return '';
    // Format as yyyy/MM/dd
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}/${m}/${d}`;
  }
}
