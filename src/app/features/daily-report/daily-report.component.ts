import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-daily-report',
  standalone: true,
  template: `
    <button (click)="goHome()" style="margin-bottom: 16px;">HOMEに戻る</button>
    <button (click)="addDailyReport()" style="margin-bottom: 24px; margin-left: 8px;">日報追加</button>
    <h2>日報</h2>
    <p>ここに日報の内容を表示します。</p>
  `,
})
export class DailyReportComponent {
  constructor(private router: Router) {}
  goHome() { this.router.navigate(['/app/dashboard']); }
  addDailyReport() { alert('日報追加ダイアログ（仮）'); }
} 