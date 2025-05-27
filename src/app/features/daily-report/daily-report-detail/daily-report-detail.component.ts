import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collectionGroup, query, where, getDocs, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { GanttDailyLogService } from '../../gantt/gantt-daily-log-form-dialog/gantt-daily-log.service';
import { RouterModule } from '@angular/router';
import { PdfExportComponent, DailyReportData } from '../../../pdf-export/pdf-export.component'
import { EditDailyReportDialogComponent } from '../../daily-report/edit-daily-report-dialog.component';
import { DailyReportService } from '../../daily-report/daily-report.service';
import type { DailyReport } from '../../daily-report/daily-report.component';
import { ConfirmDialogComponent } from '../../daily-report/daily-report.component';

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
  imports: [CommonModule, MatIconModule, MatButtonModule, RouterModule, PdfExportComponent, ConfirmDialogComponent],
  templateUrl: './daily-report-detail.component.html',
  styleUrl: './daily-report-detail.component.scss'
})
export class DailyReportDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);
  private dialog = inject(MatDialog);
  private dailyLogService = inject(GanttDailyLogService);
  private dailyReportService = inject(DailyReportService);

  dailyReportId: string | null = null;
  ganttTaskId: string | null = null;
  workLog: WorkLog | null = null;
  taskName: string | null = null;
  managerNames: string | null = null;
  dailyReport: Record<string, unknown> | null = null;
  users: {id: string, displayName: string}[] = [];
  allWorkLogs: WorkLog[] = [];

  getDisplayNameByUid(uid: unknown): string {
    if (typeof uid !== 'string') return '';
    const user = this.users.find(u => u.id === uid);
    return user ? user.displayName : uid;
  }

  getManagerNamesByUids(uids: string[] = []): string {
    return uids.map(uid => this.getDisplayNameByUid(uid)).join(', ');
  }

  getManagerUids(dr: Record<string, unknown>): string[] {
    const uids = dr['managerUids'];
    return Array.isArray(uids) ? uids.filter(uid => typeof uid === 'string') : [];
  }

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
    // Load users
    const usersSnap = await (await import('@angular/fire/firestore')).getDocs(
      (await import('@angular/fire/firestore')).collection(this.firestore, 'Users')
    );
    this.users = usersSnap.docs.map(doc => {
      const data = doc.data() as { displayName?: string, id?: string };
      return { id: data.id || doc.id, displayName: data.displayName || doc.id };
    });
    // Load all WorkLogs
    const q = collectionGroup(this.firestore, 'WorkLogs');
    const querySnapshot = await getDocs(q);
    const logs: WorkLog[] = [];
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data() as WorkLog;
      const pathSegments = docSnap.ref.path.split('/');
      const ganttTaskIdIndex = pathSegments.findIndex(seg => seg === 'GanttChartTasks') + 1;
      const ganttTaskId = ganttTaskIdIndex > 0 && ganttTaskIdIndex < pathSegments.length ? pathSegments[ganttTaskIdIndex] : '';
      // タスク名をFirestoreから取得
      let taskName = '';
      if (ganttTaskId) {
        try {
          const taskDocRef = (await import('@angular/fire/firestore')).doc(this.firestore, 'GanttChartTasks', ganttTaskId);
          const taskDocSnap = await (await import('@angular/fire/firestore')).getDoc(taskDocRef);
          if (taskDocSnap.exists()) {
            const taskData = taskDocSnap.data() as { title?: string };
            taskName = taskData.title || '';
          }
        } catch {
          // ignore Firestore errors for taskName
        }
      }
      logs.push({ ...data, id: docSnap.id, ganttTaskId, taskName });
    }
    this.allWorkLogs = logs;
  }

  get filteredLogs(): WorkLog[] {
    if (!this.dailyReport) return [];
    const reportDateStr = this.formatWorkDate(this.dailyReport['workDate']);
    const reportPersonName = this.getDisplayNameByUid(this.dailyReport['personUid']);
    return this.allWorkLogs.filter(log =>
      this.formatWorkDate(log.workDate) === reportDateStr &&
      this.getDisplayNameByUid(log['assigneeId'] || log['supervisor']) === reportPersonName
    );
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
    if (!this.dailyReport || !this.dailyReportId) return;
    // Ensure workDate is a Date and managerUids is a string array
    let workDate: Date | null = null;
    if (this.dailyReport['workDate']) {
      if (typeof this.dailyReport['workDate'] === 'string') {
        const d = new Date(this.dailyReport['workDate'] as string);
        workDate = isNaN(d.getTime()) ? null : d;
      } else if (this.dailyReport['workDate'] instanceof Date) {
        workDate = this.dailyReport['workDate'] as Date;
      } else if (typeof this.dailyReport['workDate'] === 'object' && 'toDate' in this.dailyReport['workDate'] && typeof (this.dailyReport['workDate'] as { toDate: () => Date }).toDate === 'function') {
        workDate = (this.dailyReport['workDate'] as { toDate: () => Date }).toDate();
      }
    }
    const managerUids = Array.isArray(this.dailyReport['managerUids']) ? this.dailyReport['managerUids'] : [];
    const ref = this.dialog.open(EditDailyReportDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      data: { ...this.dailyReport, id: this.dailyReportId, workDate, managerUids }
    });
    ref.afterClosed().subscribe(async (result: Record<string, unknown> | undefined) => {
      if (result && result['id']) {
        await this.dailyReportService.updateDailyReport(result['id'] as string, result as unknown as DailyReport);
        await this.reloadDailyReport();
      }
    });
  }

  private async reloadDailyReport() {
    if (!this.dailyReportId) return;
    const docRef = doc(this.firestore, 'dailyReports', this.dailyReportId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      this.dailyReport = docSnap.data();
    }
  }

  async deleteDailyLog() {
    if (!this.dailyReportId) return;
    const ref = this.dialog.open(ConfirmDialogComponent);
    const result = await ref.afterClosed().toPromise();
    if (result !== 'yes') return;
    // WorkLogも削除（ganttTaskIdがある場合のみ）
    if (this.ganttTaskId) {
      const logRefPath = `GanttChartTasks/${this.ganttTaskId}/WorkLogs/${this.dailyReportId}`;
      const logRef = (await import('@angular/fire/firestore')).doc(this.firestore, logRefPath);
      await (await import('@angular/fire/firestore')).deleteDoc(logRef);
    }
    // dailyReportsは必ず削除
    await this.dailyReportService.deleteDailyReport(this.dailyReportId);
    // 一覧に戻る
    this.router.navigate(['/app/daily-report']);
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

  public exportPdf(): void {
    // PDF export logic will go here
    alert('PDF出力は未実装です');
  }

  public goToList(): void {
    this.router.navigate(['/app/daily-report']);
  }

  public openImageDialog(url: string): void {
    // TODO: Replace with actual dialog logic if needed
    window.open(url, '_blank');
  }

  public getPhotoUrls(dr: Record<string, unknown>): string[] {
    const urls = dr['photoUrls'];
    return Array.isArray(urls) ? urls.filter(url => typeof url === 'string') : [];
  }

  public getReportDataForPdf(): DailyReportData {
    const dr = this.dailyReport;
    if (!dr) return {};
    function extractStoragePathFromUrl(url: string): string | null {
      const match = url.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
      return null;
    }
    // 日次ログデータをfilteredLogsから整形（photoUrlsも含める）
    const dailyLogs = this.filteredLogs.map(log => ({
      workDate: this.formatWorkDate(log.workDate),
      assignee: this.getDisplayNameByUid(log['assigneeId'] || log['supervisor']),
      taskName: log['taskName'] || '',
      comment: log['comment'] || '',
      photoUrls: Array.isArray(log['photoUrls']) ? log['photoUrls'].filter(url => typeof url === 'string') : []
    }));
    return {
      reportDate: this.formatWorkDate(dr['workDate']),
      staffName: this.getDisplayNameByUid(dr['personUid']),
      checkInTime: dr['startTime'] as string,
      checkOutTime: dr['endTime'] as string,
      breakTime: dr['breakTime'] ? String(dr['breakTime']) : '',
      workDuration: this.calcWorkingTime(
        this.getStartTime(dr),
        this.getEndTime(dr),
        this.getBreakTime(dr)
      ),
      reportDetails: dr['hasReport'] === 'yes' ? 'あり' : 'なし',
      injuriesOrAccidents: dr['hasAccident'] === 'yes' ? 'あり' : 'なし',
      healthIssues: dr['hasHealthIssue'] === 'yes' ? 'あり' : 'なし',
      memo: dr['memo'] as string,
      photoPaths: this.getPhotoUrls(dr)
        ? this.getPhotoUrls(dr).map(url => extractStoragePathFromUrl(url)).filter((path): path is string => !!path)
        : [],
      dailyLogs
    };
  }

  calcWorkingTime(start: string, end: string, breakMin: number): string {
    if (!start || !end || breakMin == null) return '不明';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some(isNaN)) return '不明';
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    let workMin = endMin - startMin - breakMin;
    if (workMin < 0) workMin += 24 * 60; // 日をまたぐ場合
    const h = Math.floor(workMin / 60);
    const m = workMin % 60;
    return `${h}時間${m}分`;
  }

  getString(val: unknown): string {
    return typeof val === 'string' ? val : '';
  }

  getBreakTime(dr: Record<string, unknown>): number {
    return typeof dr['breakTime'] === 'number' ? dr['breakTime'] : 0;
  }
  getStartTime(dr: Record<string, unknown>): string {
    return typeof dr['startTime'] === 'string' ? dr['startTime'] : '';
  }
  getEndTime(dr: Record<string, unknown>): string {
    return typeof dr['endTime'] === 'string' ? dr['endTime'] : '';
  }
}
