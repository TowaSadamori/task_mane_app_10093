import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'; // MAT_DIALOG_DATA をインポート
import { MatButtonModule } from '@angular/material/button'; // MatButtonModule をインポート
import { CommonModule } from '@angular/common'; // CommonModule をインポート


export interface ConfirmDialogData { // ダイアログに渡すデータの型を定義 (今回はメッセージのみ)
  message: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule, // CommonModule を追加
    MatDialogModule,
    MatButtonModule
  ],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {

  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData // ★ MAT_DIALOG_DATA を使ってデータを受け取る
  ) {}

  onNoClick(): void {
    this.dialogRef.close(false); // キャンセル時は false を返す
  }

  onYesClick(): void {
    this.dialogRef.close(true); // 削除実行時は true を返す
  }
}