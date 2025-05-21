import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-weekly-report',
  standalone: true,
  template: `
    <button (click)="goHome()" style="margin-bottom: 16px;">HOMEに戻る</button>
    <button (click)="addWeeklyReport()" style="margin-bottom: 24px; margin-left: 8px;">週報追加</button>
    <h2>週報</h2>
    <p>ここに週報の内容を表示します。</p>
  `,
})
export class WeeklyReportComponent {
  constructor(private router: Router) {}
  goHome() { this.router.navigate(['/app/dashboard']); }
  addWeeklyReport() { alert('週報追加ダイアログ（仮）'); }
} 