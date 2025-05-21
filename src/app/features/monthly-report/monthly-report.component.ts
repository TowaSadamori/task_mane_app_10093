import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-monthly-report',
  standalone: true,
  template: `
    <button (click)="goHome()" style="margin-bottom: 16px;">HOMEに戻る</button>
    <button (click)="addMonthlyReport()" style="margin-bottom: 24px; margin-left: 8px;">月報追加</button>
    <h2>月報</h2>
    <p>ここに月報の内容を表示します。</p>
  `,
})
export class MonthlyReportComponent {
  constructor(private router: Router) {}
  goHome() { this.router.navigate(['/app/dashboard']); }
  addMonthlyReport() { alert('月報追加ダイアログ（仮）'); }
} 