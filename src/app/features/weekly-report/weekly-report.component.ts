import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AddWeeklyReportDialogComponent } from './add-weekly-report-dialog.component';
import { Firestore, collection, getDocs, query, orderBy, doc, deleteDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { UserService } from '../../core/user.service';
import { User } from '../../core/models/user.model';
import { MatIconModule } from '@angular/material/icon';
import { DailyReportService } from '../daily-report/daily-report.service';
import { RouterModule } from '@angular/router';
import { WeeklyReportPdfExportComponent, WeeklyReportPdfData } from '../../pdf-export/weekly-report-pdf-export.component';

@Component({
  selector: 'app-weekly-report',
  standalone: true,
  imports: [CommonModule, AddWeeklyReportDialogComponent, MatIconModule, RouterModule, WeeklyReportPdfExportComponent],
  templateUrl: './weekly-report.component.html',
  styleUrl: './weekly-report.component.scss'
})
export class WeeklyReportComponent {
  reports: Record<string, unknown>[] = [];
  users: User[] = [];
  weeklyDailyReports: Record<string, Record<string, unknown>[]> = {};
  weeklyPdfFunctionUrl = 'https://asia-northeast1-kensyu10093.cloudfunctions.net/generateWeeklyPdf'; // 本番用URLに変更
  constructor(private router: Router, private dialog: MatDialog, private firestore: Firestore, private userService: UserService, private dailyReportService: DailyReportService, private cdr: ChangeDetectorRef) {
    this.userService.getUsers().subscribe(users => {
      this.users = users;
      this.loadReports();
    });
  }

  async loadDailyReportsForWeeklyReport(report: Record<string, unknown>) {
    const personDisplayName = report['person'];
    const user = this.users.find(u => u.displayName === personDisplayName);
    if (!user) {
      this.weeklyDailyReports[report['id'] as string] = [];
      return;
    }
    const personUid = user.id;
    const startRaw = report['periodStart'];
    const endRaw = report['periodEnd'];
    let start: Date | null = null;
    let end: Date | null = null;
    if (typeof startRaw === 'string' || startRaw instanceof Date) start = new Date(startRaw);
    if (typeof endRaw === 'string' || endRaw instanceof Date) end = new Date(endRaw);
    if (typeof startRaw === 'object' && startRaw !== null && typeof (startRaw as { toDate?: unknown }).toDate === 'function') start = (startRaw as { toDate: () => Date }).toDate();
    if (typeof endRaw === 'object' && endRaw !== null && typeof (endRaw as { toDate?: unknown }).toDate === 'function') end = (endRaw as { toDate: () => Date }).toDate();
    if (!start || !end) {
      this.weeklyDailyReports[report['id'] as string] = [];
      return;
    }
    const allDailyReports = (await this.dailyReportService.getDailyReports() as unknown) as Record<string, unknown>[];
    this.weeklyDailyReports[report['id'] as string] = allDailyReports
      .filter(dr => {
        let workDate: Date | null = null;
        if (dr['workDate'] instanceof Date) workDate = dr['workDate'] as Date;
        else if (typeof dr['workDate'] === 'string') workDate = new Date(dr['workDate'] as string);
        else if (typeof dr['workDate'] === 'object' && dr['workDate'] !== null && typeof (dr['workDate'] as { toDate?: unknown }).toDate === 'function') workDate = (dr['workDate'] as { toDate: () => Date }).toDate();
        if (!workDate) return false;
        return (
          dr['personUid'] === personUid &&
          workDate >= start &&
          workDate <= end
        );
      })
      .sort((a, b) => {
        let dateA: Date | null = null;
        let dateB: Date | null = null;
        if (a['workDate'] instanceof Date) dateA = a['workDate'] as Date;
        else if (typeof a['workDate'] === 'string') dateA = new Date(a['workDate'] as string);
        else if (typeof a['workDate'] === 'object' && a['workDate'] !== null && typeof (a['workDate'] as { toDate?: unknown }).toDate === 'function') dateA = (a['workDate'] as { toDate: () => Date }).toDate();
        if (b['workDate'] instanceof Date) dateB = b['workDate'] as Date;
        else if (typeof b['workDate'] === 'string') dateB = new Date(b['workDate'] as string);
        else if (typeof b['workDate'] === 'object' && b['workDate'] !== null && typeof (b['workDate'] as { toDate?: unknown }).toDate === 'function') dateB = (b['workDate'] as { toDate: () => Date }).toDate();
        if (!dateA || !dateB) return 0;
        return dateA.getTime() - dateB.getTime();
      })
      .map(dr => {
        let workDateDisplay = '';
        if (dr['workDate'] instanceof Date) {
          workDateDisplay = dr['workDate'].toLocaleDateString('ja-JP');
        } else if (typeof dr['workDate'] === 'string') {
          const d = new Date(dr['workDate'] as string);
          workDateDisplay = isNaN(d.getTime()) ? '' : d.toLocaleDateString('ja-JP');
        } else if (typeof dr['workDate'] === 'object' && dr['workDate'] !== null && typeof (dr['workDate'] as { toDate?: unknown }).toDate === 'function') {
          workDateDisplay = (dr['workDate'] as { toDate: () => Date }).toDate().toLocaleDateString('ja-JP');
        }
        const personUidDisplay = typeof dr['personUid'] === 'string' ? dr['personUid'] : '';
        const startTime = typeof dr['startTime'] === 'string' ? dr['startTime'] : '';
        const endTime = typeof dr['endTime'] === 'string' ? dr['endTime'] : '';
        const breakTime = typeof dr['breakTime'] === 'number' ? dr['breakTime'] : 0;
        const workMinutes = this.calcWorkingMinutes(startTime, endTime, breakTime);
        const workDuration = this.formatMinutes(workMinutes);
        return {
          id: dr['id'] ?? '',
          workDateDisplay,
          personUidDisplay,
          startTime,
          endTime,
          breakTime,
          workDuration,
          workMinutes
        };
      });
  }

  async loadReports() {
    const col = collection(this.firestore, 'weeklyReports');
    const q = query(col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    this.reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    for (const report of this.reports) {
      await this.loadDailyReportsForWeeklyReport(report);
    }
    this.cdr.detectChanges();
  }

  goHome() {
    this.router.navigate(['/app/dashboard']);
  }

  openAddDialog() {
    const confirmed = window.confirm('日次報告書(日報)は適切に追加、修正しましたか？');
    if (!confirmed) return;
    const dialogRef = this.dialog.open(AddWeeklyReportDialogComponent, { width: '400px', maxHeight: '80vh' });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadReports();
      }
    });
  }

  getUserName(id: string | unknown): string {
    if (typeof id !== 'string') return '';
    const user = this.users.find(u => u.id === id);
    return user ? user.displayName : id;
  }

  getManagerNames(report: Record<string, unknown>): string {
    if (!report['manager'] || !Array.isArray(report['manager'])) return '';
    return (report['manager'] as string[]).map(id => this.getUserName(id)).join(', ');
  }

  getPeriodDate(report: Record<string, unknown>, key: 'periodStart' | 'periodEnd'): string {
    const val = report[key];
    if (!val) return '';
    if (typeof val === 'string' || val instanceof Date) {
      return new Date(val).toLocaleDateString('ja-JP');
    }
    if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().toLocaleDateString('ja-JP');
    }
    return '';
  }

  getPhotoUrls(report: Record<string, unknown>): string[] {
    const urls = report['photoUrls'];
    return Array.isArray(urls) ? urls.filter(url => typeof url === 'string') : [];
  }

  openDetailDialog(report: Record<string, unknown>) {
    // 詳細ダイアログは後で実装
    alert('詳細ダイアログ（仮）\n' + JSON.stringify(report, null, 2));
  }

  openImageDialog(url: string) {
    window.open(url, '_blank');
  }

  async downloadImage(url: string) {
    try {
      const downloadUrl = url.includes('?') ? url + '&alt=media' : url + '?alt=media';
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = url.split('/').pop()?.split('?')[0] || 'image.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      alert('ダウンロードに失敗しました');
    }
  }

  getWorkDays(report: Record<string, unknown>): number {
    const id = this.getReportId(report);
    return this.weeklyDailyReports[id]?.length ?? 0;
  }

  async onEdit(report: Record<string, unknown>) {
    const data = {
      ...report,
      manager: Array.isArray(report['manager']) ? [...report['manager']] : [],
      photoUrls: Array.isArray(report['photoUrls']) ? [...report['photoUrls']] : []
    };
    const dialogRef = this.dialog.open(AddWeeklyReportDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      data
    });
    dialogRef.afterClosed().subscribe(async (result: Record<string, unknown> | undefined) => {
      if (result) {
        await this.loadReports();
      }
    });
  }

  async onDelete(report: Record<string, unknown>) {
    if (!report['id']) return;
    const ok = window.confirm('本当に削除しますか？');
    if (!ok) return;
    const ref = doc(this.firestore, 'weeklyReports', report['id'] as string);
    await deleteDoc(ref);
    await this.loadReports();
  }

  getReportId(report: Record<string, unknown>): string {
    return String(report['id'] ?? '');
  }

  calcWorkingMinutes(start: string, end: string, breakMin: number): number {
    if (!start || !end || breakMin == null) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if ([sh, sm, eh, em].some(isNaN)) return 0;
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    let workMin = endMin - startMin - breakMin;
    if (workMin < 0) workMin += 24 * 60;
    return workMin;
  }

  formatMinutes(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}時間${m}分`;
  }

  getWeeklyWorkTimeTotal(report: Record<string, unknown>): string {
    const id = this.getReportId(report);
    const dailyReports = this.weeklyDailyReports[id] ?? [];
    const totalMin = dailyReports.reduce((sum, dr) => sum + (typeof dr['workMinutes'] === 'number' ? dr['workMinutes'] : 0), 0);
    return this.formatMinutes(totalMin);
  }

  /**
   * 週報データをWeeklyReportPdfData型に整形
   */
  buildWeeklyPdfData(report: Record<string, unknown>): WeeklyReportPdfData {
    const period = `${this.getPeriodDate(report, 'periodStart')} ～ ${this.getPeriodDate(report, 'periodEnd')}`;
    const staffName = this.getUserName(report['person'] ? report['person'].toString() : '');
    const managerNames = this.getManagerNames(report);
    const memo = report['memo'] as string || '';
    const workDays = this.getWorkDays(report);
    const workTimeTotal = this.getWeeklyWorkTimeTotal(report);
    const photoUrls = this.getPhotoUrls(report);
    const id = this.getReportId(report);
    const dailyLogs = (this.weeklyDailyReports[id] || []).map(dr => ({
      workDate: String(dr['workDateDisplay'] || ''),
      assignee: this.getUserName(dr['personUidDisplay'] || ''),
      workTime: String(dr['workDuration'] || '')
    }));
    return { period, staffName, managerNames, memo, workDays, workTimeTotal, photoUrls, dailyLogs };
  }
}
