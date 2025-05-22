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
    MatIconModule
  ],
  templateUrl: './daily-report.component.html',
  styleUrls: ['./daily-report.component.scss']
})
export class DailyReportComponent {
  reports: DailyReport[] = [];
  constructor(private dialog: MatDialog, private dailyReportService: DailyReportService, private router: Router) {
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
}
