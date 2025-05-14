import { Component, Inject, OnInit } from '@angular/core'; // OnInit を追加
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
// リアクティブフォーム関連をインポート
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
// Angular Material フォームフィールド、入力、日付選択関連をインポート
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; // Datepickerに必要

@Component({
  selector: 'app-add-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, // リアクティブフォームモジュールを追加
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule, // Materialフォームフィールドモジュールを追加
    MatInputModule,     // Material入力モジュールを追加
    MatDatepickerModule, // Material日付選択モジュールを追加
    MatNativeDateModule // Material日付選択に必要
  ],
  templateUrl: './add-task-dialog.component.html',
  styleUrls: ['./add-task-dialog.component.scss']
})
export class AddTaskDialogComponent implements OnInit { // OnInit を実装
  taskForm: FormGroup;

  constructor(
    private fb: FormBuilder, // FormBuilder を注入
    public dialogRef: MatDialogRef<AddTaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: unknown // 親コンポーネントからデータを受け取る場合
  ) {
    // フォームグループを初期化
    this.taskForm = this.fb.group({
      taskName: ['', Validators.required], // タスク名、必須入力
      plannedStartDate: [null, Validators.required], // 予定開始日、必須入力
      plannedEndDate: [null, Validators.required]   // 予定終了日、必須入力
    });
  }

  ngOnInit(): void {
    console.log('AddTaskDialogComponent initialized. Data:', this.data);
    // もし編集モードなどで初期値を設定したい場合はここで行う
    // 例: if (this.data && (this.data as any).taskToEdit) {
    //   this.taskForm.patchValue((this.data as any).taskToEdit);
    // }
  }
  
  onNoClick(): void {
    this.dialogRef.close();
  }

  // フォーム送信時の処理（今回はまだ呼ばれないが、将来的に「追加」ボタンから呼ぶ）
  onSubmit(): void {
    if (this.taskForm.valid) {
      this.dialogRef.close(this.taskForm.value); // フォームの値を親コンポーネントに渡す
    }
  }
}