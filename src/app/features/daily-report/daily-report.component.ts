import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AddDailyReportDialogComponent } from './add-daily-report-dialog.component';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { DailyReportService } from './daily-report.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Router } from '@angular/router';
import type { Timestamp } from 'firebase/firestore';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { ImageViewDialogComponent } from './image-view-dialog.component';
import { EditDailyReportDialogComponent } from './edit-daily-report-dialog.component';
import { PdfExportComponent, DailyReportData } from '../../pdf-export/pdf-export.component';
import { UserService } from '../../core/user.service';
import { User } from '../../core/models/user.model';
import { Firestore, collectionGroup, getDocs } from '@angular/fire/firestore';
import { RouterModule } from '@angular/router';

export interface DailyReport {
  workDate: Date | string;
  personUid: string;
  startTime: string;
  endTime: string;
  breakTime: number;
  hasReport: string;
  hasAccident: string;
  hasHealthIssue: string;
  memo: string;
  photos: File[];
  id?: string;
  photoNames?: string[];
  photoUrls?: string[];
  createdAt?: Timestamp | string;
  managerUids?: string[];
  projectId?: string;
}

// WorkLog型（dashboard参照）
interface WorkLogForDisplay {
  id: string;
  ganttTaskId: string;
  assigneeId: string;
  supervisor?: string;
  workDate?: Date | { toDate: () => Date } | string;
  taskName?: string;
  projectName?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualBreakTime?: number;
  progressRate?: number;
  workerCount?: number;
  comment?: string;
  photoUrls?: string[];
}

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <h2 mat-dialog-title>本当に削除しますか？</h2>
    <mat-dialog-actions align="center">
      <button mat-button mat-dialog-close="no">いいえ</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="'yes'">はい</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [MatButtonModule, MatDialogModule]
})
export class ConfirmDialogComponent {}

@Component({
  selector: 'app-daily-report',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    PdfExportComponent,
    RouterModule
  ],
  templateUrl: './daily-report.component.html',
  styleUrls: ['./daily-report.component.scss']
})
export class DailyReportComponent {
  reports: DailyReport[] = [];
  users: User[] = [];
  allWorkLogs: WorkLogForDisplay[] = [];
  constructor(
    private dialog: MatDialog,
    private dailyReportService: DailyReportService,
    private router: Router,
    private userService: UserService,
    private firestore: Firestore
  ) {
    this.loadUsersAndReports();
    this.loadAllWorkLogs();
  }
  async loadUsersAndReports() {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
    this.reports = await this.dailyReportService.getDailyReports();
  }
  getDisplayNameByUid(uid: string): string {
    const user = this.users.find(u => u.id === uid);
    return user ? user.displayName : uid;
  }
  getManagerNamesByUids(uids: string[] = []): string {
    return uids.map(uid => this.getDisplayNameByUid(uid)).join(', ');
  }
  openAddDialog() {
    const ref = this.dialog.open(AddDailyReportDialogComponent, { width: '400px', maxHeight: '80vh' });
    ref.afterClosed().subscribe(async (result: DailyReport | undefined) => {
      if (result) {
        await this.dailyReportService.addDailyReport(result);
        await this.loadUsersAndReports();
      }
    });
  }


  goHome() {
    this.router.navigate(['/app/dashboard']);
  }
  getCreatedAtDate(createdAt: string | Timestamp | undefined | null): Date | null {
    if (!createdAt) return null;
    if (typeof createdAt === 'string') {
      const d = new Date(createdAt);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof createdAt === 'object' && 'toDate' in createdAt && typeof createdAt.toDate === 'function') {
      return createdAt.toDate();
    }
    return null;
  }

  async deleteReport(id: string) {
    const ref = this.dialog.open(ConfirmDialogComponent);
    const result = await ref.afterClosed().toPromise();
    if (result === 'yes') {
      await this.dailyReportService.deleteDailyReport(id);
      await this.loadUsersAndReports();
    }
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
  openImageDialog(url: string) {
    this.dialog.open(ImageViewDialogComponent, {
      data: { url },
      panelClass: 'image-view-dialog-panel'
    });
  }
  downloadImage(url: string) {
    const filename = url.split('/').pop()?.split('?')[0] || 'image.jpg';
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      });
  }
  openEditDialog(report: DailyReport) {
    const ref = this.dialog.open(EditDailyReportDialogComponent, {
      width: '400px',
      maxHeight: '80vh',
      data: report
    });
    ref.afterClosed().subscribe(async (result: DailyReport | undefined) => {
      if (result && result.id) {
        await this.dailyReportService.updateDailyReport(result.id, result);
        await this.loadUsersAndReports();
      }
    });
  }
  getReportDataForPdf(report: DailyReport): DailyReportData {
    // photoUrlsがダウンロードURLの場合、Storageパスを抽出
    function extractStoragePathFromUrl(url: string): string | null {
      // 例: https://firebasestorage.googleapis.com/v0/b/xxx/o/dailyReports%2Fxxxx.png?alt=media...
      const match = url.match(/\/o\/([^?]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
      return null;
    }
    return {
      reportDate: typeof report.workDate === 'string' ? report.workDate : (report.workDate instanceof Date ? report.workDate.toLocaleDateString() : ''),
      staffName: report.personUid,
      checkInTime: report.startTime,
      checkOutTime: report.endTime,
      breakTime: report.breakTime ? report.breakTime.toString() : '',
      workDuration: this.calcWorkingTime(report.startTime, report.endTime, report.breakTime),
      reportDetails: report.hasReport === 'yes' ? 'あり' : 'なし',
      injuriesOrAccidents: report.hasAccident === 'yes' ? 'あり' : 'なし',
      healthIssues: report.hasHealthIssue === 'yes' ? 'あり' : 'なし',
      memo: report.memo,
      photoPaths: report.photoUrls
        ? report.photoUrls.map(url => extractStoragePathFromUrl(url)).filter((path): path is string => !!path)
        : []
    };
  }
  async loadAllWorkLogs() {
    const q = collectionGroup(this.firestore, 'WorkLogs');
    const querySnapshot = await getDocs(q);
    const logs: WorkLogForDisplay[] = [];
    querySnapshot.forEach(docSnap => {
      const pathSegments = docSnap.ref.path.split('/');
      const ganttTaskId = pathSegments[1];
      const data = docSnap.data();
      logs.push({
        ...data,
        id: docSnap.id,
        ganttTaskId: ganttTaskId,
        assigneeId: data['supervisor'] || data['assigneeId'] || '',
        workDate: data['workDate'],
        actualStartTime: data['actualStartTime'],
        actualEndTime: data['actualEndTime'],
        actualBreakTime: data['actualBreakTime'],
        progressRate: data['progressRate'],
        workerCount: data['workerCount'],
        comment: data['comment'],
        photoUrls: data['photoUrls']
      });
    });
    this.allWorkLogs = logs;
  }
  // WorkLogの日付を安全にyyyy/MM/ddで返す
  formatWorkLogDate(date: Date | { toDate: () => Date } | string | undefined | null): string {
    if (!date) return '';
    if (date instanceof Date) {
      return date.toLocaleDateString('ja-JP');
    }
    if (typeof date === 'object' && typeof date.toDate === 'function') {
      const d = date.toDate();
      return d instanceof Date ? d.toLocaleDateString('ja-JP') : '';
    }
    if (typeof date === 'string') {
      const d = new Date(date);
      return isNaN(d.getTime()) ? date : d.toLocaleDateString('ja-JP');
    }
    return '';
  }
  // 日報の作業日と一致する日次ログだけ返す
  getLogsForReport(report: DailyReport): WorkLogForDisplay[] {
    const reportDateStr = this.formatWorkLogDate(report.workDate);
    const reportPersonName = this.getDisplayNameByUid(report.personUid);
    return this.allWorkLogs.filter(log =>
      this.formatWorkLogDate(log.workDate) === reportDateStr &&
      this.getDisplayNameByUid(log.assigneeId) === reportPersonName
    );
  }
}
