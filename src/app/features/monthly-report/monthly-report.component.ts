import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AddMonthlyReportDialogComponent } from './add-monthly-report-dialog.component';

@Component({
  selector: 'app-monthly-report',
  standalone: true,
  templateUrl: './monthly-report.component.html',
  styleUrl: './monthly-report.component.scss'
})
export class MonthlyReportComponent {
  constructor(private router: Router, private dialog: MatDialog) {}

  goHome() {
    this.router.navigate(['/app/dashboard']);
  }

  openAddDialog() {
    this.dialog.open(AddMonthlyReportDialogComponent, { width: '400px', maxHeight: '80vh' });
  }
}
