import { Component, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';

// 週報PDF用データ型（Cloud Functions側もこの構造を想定してください）
export interface WeeklyReportPdfData {
  period: string; // 例: "2025/5/21 ～ 2025/5/27"
  staffName: string; // 担当者名
  managerNames: string; // 管理者名（カンマ区切り）
  memo: string;
  workDays: number;
  workTimeTotal: string; // 例: "26時間50分"
  photoUrls?: string[]; // QRコード化するURL
  dailyLogs?: { workDate: string; assignee: string; workTime: string }[]; // 日報一覧
}

@Component({
  selector: 'app-weekly-report-pdf-export',
  standalone: true,
  template: `
    <button (click)="exportPdf()" style="background:#ff9800;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;">
      <span class="material-icons" style="vertical-align:middle;">picture_as_pdf</span> PDF出力
    </button>
  `,
})
export class WeeklyReportPdfExportComponent {
  @Input() reportData!: WeeklyReportPdfData;
  @Input() functionUrl = 'http://localhost:5001/kensyu10093/us-central1/generateWeeklyPdf'; // 週報用Cloud Function等

  constructor(private http: HttpClient) {}

  exportPdf() {
    if (!this.reportData) return;
    // Cloud Functions側でQRコード＋URL出力を実装してください
    this.http.post(this.functionUrl, this.reportData, { responseType: 'blob' })
      .subscribe(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `週報_${this.reportData.period || 'report'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }
} 