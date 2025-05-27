import { Component, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface MonthlyReportPdfData {
  period: string; // 例: "2025/5/1 ～ 2025/5/31"
  staffName: string;
  managerNames: string;
  memo: string;
  workDays: number;
  workTimeTotal: string;
  photoUrls?: string[];
  dailyLogs?: { workDate: string; assignee: string; workTime: string }[];
}

@Component({
  selector: 'app-monthly-report-pdf-export',
  standalone: true,
  template: `
    <button (click)="exportPdf()" style="background:#ff9800;color:#fff;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;">
      <span class="material-icons" style="vertical-align:middle;">picture_as_pdf</span> PDF出力
    </button>
  `,
})
export class MonthlyReportPdfExportComponent {
  @Input() reportData!: MonthlyReportPdfData;
  @Input() functionUrl = 'http://localhost:5001/kensyu10093/us-central1/generateMonthlyPdf'; // 月報用Cloud Function

  constructor(private http: HttpClient) {}

  exportPdf() {
    if (!this.reportData) return;
    this.http.post(this.functionUrl, this.reportData, { responseType: 'blob' })
      .subscribe(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `月報_${this.reportData.period || 'report'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }
} 