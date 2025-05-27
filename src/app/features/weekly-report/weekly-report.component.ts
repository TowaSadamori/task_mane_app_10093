import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AddWeeklyReportDialogComponent } from './add-weekly-report-dialog.component';
import { Firestore, collection, getDocs, query, orderBy } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-weekly-report',
  standalone: true,
  imports: [CommonModule, AddWeeklyReportDialogComponent],
  templateUrl: './weekly-report.component.html',
  styleUrl: './weekly-report.component.scss'
})
export class WeeklyReportComponent {
  reports: Record<string, unknown>[] = [];
  constructor(private router: Router, private dialog: MatDialog, private firestore: Firestore) {
    this.loadReports();
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

  getManagerNames(report: Record<string, unknown>): string {
    if (!report['manager'] || !Array.isArray(report['manager'])) return '';
    return (report['manager'] as string[]).join(', ');
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
}
