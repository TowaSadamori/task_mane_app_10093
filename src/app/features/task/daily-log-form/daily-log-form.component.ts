import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TaskService, Task } from '../../../core/task.service';

@Component({
  selector: 'app-daily-log-form',
  standalone: true,
  imports:[
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl:'./daily-log-form.component.html',
  styleUrls: ['./daily-log-form.component.scss'],
})

export class DailyLogFormComponent implements OnInit {
  dailyLogForm!: FormGroup;
  formError: string | null = null;
  isLoading = false;

  private taskService = inject(TaskService);

  @Input() taskId!: string;

  constructor() { }

  ngOnInit(): void {
    this.dailyLogForm = new FormGroup({
      'workDate': new FormControl<Date | null>(null, [Validators.required]),
      'actualStartTime': new FormControl('', [Validators.required]),
      'actualEndTime': new FormControl('', [Validators.required]),
      'actualBreakTime': new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
      'progressRate': new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
      'workerCount': new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
      'supervisor': new FormControl('', [Validators.required]),
      'comment': new FormControl(''),
    });
  }

  async onSubmit(): Promise<void> {
    if (this.dailyLogForm.invalid || !this.taskId) {
      this.dailyLogForm.markAllAsTouched();
      console.error('Form is invalid or taskId is missing');
      this.formError = '入力内容に誤りがあるか、タスクIDが指定されていません。';
      return;
    }

    this.isLoading = true;
    this.formError = null;

    const logData = this.dailyLogForm.value;

    try { 
      const docRef = await this.taskService.addDailyLog(this.taskId, logData);
      console.log('日次ログ保存成功: Document written with ID: ', docRef.id);

      alert(`日次ログを保存しました!(ID: ${docRef.id})`);
      this.dailyLogForm.reset();

    } catch (error: unknown) {
      console.error('日次ログ保存失敗: ', error);
      let errorMessage = '日次ログの保存に失敗しました。時間をおいて再度お試しください。';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      this.formError = errorMessage;
    }finally {
      this.isLoading = false;
    }

    console.log('Daily Log Form Submitted!', this.dailyLogForm.value);
  }
}

