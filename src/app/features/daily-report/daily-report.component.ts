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
import { CsvExportComponent } from '../../shared/csv-export.component';
import { Firestore, collectionGroup, query, where, getDocs } from '@angular/fire/firestore';

export interface DailyReport {
  workDate: Date | string;
  person: string;
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
}

export interface WorkLog {
  workDate: string; // 例: '2025-05-22' など。型は保存形式に合わせて調整
  startTime?: string;
  endTime?: string;
  breakTime?: number;
  progress?: number;
  staffCount?: number;
  supervisor?: string;
  comment?: string;
  photos?: string[];
  [key: string]: unknown;
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
    CsvExportComponent
  ],
  templateUrl: './daily-report.component.html',
  styleUrls: ['./daily-report.component.scss']
})
export class DailyReportComponent {
  reports: DailyReport[] = [];
  dailyLogs: WorkLog[] = [];
  constructor(private dialog: MatDialog, private dailyReportService: DailyReportService, private router: Router, private firestore: Firestore) {
    this.loadReports();
  }
  async loadReports() {
    this.reports = await this.dailyReportService.getDailyReports();
  }
  openAddDialog() {
    const ref = this.dialog.open(AddDailyReportDialogComponent, { width: '400px', maxHeight: '80vh' });
    ref.afterClosed().subscribe(async (result: DailyReport | undefined) => {
      if (result) {
        await this.dailyReportService.addDailyReport(result);
        await this.loadReports();
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
      await this.loadReports();
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
        await this.loadReports();
      }
    });
  }
  getReportDataForPdf(report: DailyReport): DailyReportData {
    return {
      reportDate: typeof report.workDate === 'string' ? report.workDate : (report.workDate instanceof Date ? report.workDate.toLocaleDateString() : ''),
      staffName: report.person,
      checkInTime: report.startTime,
      checkOutTime: report.endTime,
      breakTime: report.breakTime ? report.breakTime.toString() : '',
      workDuration: this.calcWorkingTime(report.startTime, report.endTime, report.breakTime),
      reportDetails: report.hasReport === 'yes' ? 'あり' : 'なし',
      injuriesOrAccidents: report.hasAccident === 'yes' ? 'あり' : 'なし',
      healthIssues: report.hasHealthIssue === 'yes' ? 'あり' : 'なし',
      memo: report.memo,
      photoPaths: report.photoUrls ?? []
    };
  }
  async loadDailyLogsByDate(workDate: string) {
    // workDateは '2025-05-22' など。保存形式に合わせて調整
    const q = query(
      collectionGroup(this.firestore, 'WorkLogs'),
      where('workDate', '==', workDate)
    );
    const snap = await getDocs(q);
    this.dailyLogs = snap.docs.map(doc => doc.data() as WorkLog);
  }
  async getDailyLogsForReport(report: DailyReport): Promise<WorkLog[]> {
    // workDateの型に応じて整形
    let workDateStr = '';
    if (report.workDate instanceof Date) {
      workDateStr = report.workDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    } else if (typeof report.workDate === 'string') {
      workDateStr = report.workDate.length > 10 ? report.workDate.slice(0, 10) : report.workDate;
    }
    const q = query(
      collectionGroup(this.firestore, 'WorkLogs'),
      where('workDate', '==', workDateStr)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as WorkLog);
  }
}
