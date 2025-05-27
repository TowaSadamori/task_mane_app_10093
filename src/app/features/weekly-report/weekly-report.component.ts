import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AddWeeklyReportDialogComponent } from './add-weekly-report-dialog.component';
import { Firestore, collection, getDocs, query, orderBy, doc, deleteDoc } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { UserService } from '../../core/user.service';
import { User } from '../../core/models/user.model';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-weekly-report',
  standalone: true,
  imports: [CommonModule, AddWeeklyReportDialogComponent, MatIconModule],
  templateUrl: './weekly-report.component.html',
  styleUrl: './weekly-report.component.scss'
})
export class WeeklyReportComponent {
  reports: Record<string, unknown>[] = [];
  users: User[] = [];
  constructor(private router: Router, private dialog: MatDialog, private firestore: Firestore, private userService: UserService) {
    this.loadReports();
    this.userService.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  async loadReports() {
    const col = collection(this.firestore, 'weeklyReports');
    const q = query(col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    this.reports = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  goHome() {
    this.router.navigate(['/app/dashboard']);
  }

  openAddDialog() {
    const dialogRef = this.dialog.open(AddWeeklyReportDialogComponent, { width: '400px', maxHeight: '80vh' });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadReports();
      }
    });
  }

  getUserName(id: string): string {
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

  getWorkDays(report: Record<string, unknown>): number {
    const start = report['periodStart'];
    const end = report['periodEnd'];
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    if (typeof start === 'string' || start instanceof Date) startDate = new Date(start);
    if (typeof end === 'string' || end instanceof Date) endDate = new Date(end);
    if (typeof start === 'object' && start !== null && 'toDate' in start && typeof start.toDate === 'function') startDate = start.toDate();
    if (typeof end === 'object' && end !== null && 'toDate' in end && typeof end.toDate === 'function') endDate = end.toDate();
    if (!startDate || !endDate) return 0;
    const diff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  }

  async onEdit(report: Record<string, unknown>) {
    const dialogRef = this.dialog.open(AddWeeklyReportDialogComponent, {
      width: '500px',
      maxHeight: '90vh',
      data: { ...report }
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

  onPdf(report: Record<string, unknown>) {
    alert('PDF出力（仮）\n' + JSON.stringify(report, null, 2));
  }
}
