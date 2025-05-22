import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AddWeeklyReportDialogComponent } from './add-weekly-report-dialog.component';

@Component({
  selector: 'app-weekly-report',
  standalone: true,
  templateUrl: './weekly-report.component.html',
  styleUrl: './weekly-report.component.scss'
})
export class WeeklyReportComponent {
  constructor(private router: Router, private dialog: MatDialog) {}

  goHome() {
    this.router.navigate(['/app/dashboard']);
  }

  openAddDialog() {
    this.dialog.open(AddWeeklyReportDialogComponent, { width: '400px', maxHeight: '80vh' });
  }
}
