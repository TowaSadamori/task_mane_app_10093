import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collectionGroup, query, where, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GanttDailyLogFormDialogComponent } from '../../gantt/gantt-daily-log-form-dialog/gantt-daily-log-form-dialog.component';
import { GanttDailyLogService, GanttDailyLog } from '../../gantt/gantt-daily-log-form-dialog/gantt-daily-log.service';

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
  imports: [CommonModule, MatIconModule, MatButtonModule],
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

  async ngOnInit() {
    this.dailyReportId = this.route.snapshot.paramMap.get('dailyReportId');
    if (this.dailyReportId) {
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
}
