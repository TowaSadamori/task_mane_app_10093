import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-csv-export',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './csv-export.component.html',
  styleUrl: './csv-export.component.scss'
})
export class CsvExportComponent {
  /**
   * CSVに変換するデータ（配列または1件のオブジェクト）
   */
  @Input() data: object[] | object = [];
  /**
   * ヘッダー行（例: ['作業日', '担当者', ...]）
   */
  @Input() headers: string[] = [];
  /**
   * データの各列に対応するキー（例: ['date', 'person', ...]）
   */
  @Input() keys: string[] = [];
  /**
   * ダウンロード時のファイル名
   */
  @Input() fileName = 'export.csv';
  /**
   * ボタンのラベル
   */
  @Input() label = 'CSV出力';

  exportToCSV() {
    const arr = Array.isArray(this.data) ? this.data : [this.data];
    const csvRows = arr.map(row =>
      this.keys.map(key => {
        let v = (row as Record<string, unknown>)[key];
        if (Array.isArray(v)) v = v.join(';');
        if (v === undefined || v === null) v = '';
        // unknown型をstringへ安全に変換
        const cell = typeof v === 'string' ? v : (typeof v === 'number' ? v.toString() : JSON.stringify(v));
        return `"${cell.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csvContent = [this.headers.join(','), ...csvRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = this.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
}
