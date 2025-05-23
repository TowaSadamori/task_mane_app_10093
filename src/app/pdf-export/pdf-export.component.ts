import { Component, Input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';

// 必要に応じて拡張してください
export interface DailyReportData {
  staffName?: string;
  reportDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  breakTime?: string;
  workDuration?: string;
  reportDetails?: string;
  injuriesOrAccidents?: string;
  healthIssues?: string;
  memo?: string;
  photoPaths?: string[];
  // ...他の項目も必要に応じて追加
}

@Component({
  selector: 'app-pdf-export',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './pdf-export.component.html',
  styleUrl: './pdf-export.component.scss'
})
export class PdfExportComponent {
  @Input() reportData!: DailyReportData;
  @Input() functionUrl = 'http://localhost:5001/kensyu10093/us-central1/generatePdf'; // 必要に応じて変更

  constructor(private http: HttpClient) {}

  exportPdf() {
    if (!this.reportData) return;
    console.log('送信する日報データ:', JSON.stringify(this.reportData, null, 2));
    this.http.post(this.functionUrl, this.reportData, { responseType: 'blob' })
      .subscribe(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `日報_${this.reportData.staffName || 'report'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      });
  }
}
