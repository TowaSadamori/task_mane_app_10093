import { Component, Inject, Input } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TaskService } from '../../core/task.service';

@Component({
  selector: 'app-daily-log-form-simple',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
  ],
  templateUrl: './daily-log-form-simple.component.html',
  styleUrl: './daily-log-form-simple.component.scss'
})
export class DailyLogFormSimpleComponent {
  @Input() taskId?: string; // 親から直接渡す場合用
  form: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private taskService: TaskService,
    private dialogRef: MatDialogRef<DailyLogFormSimpleComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { taskId: string }
  ) {
    this.form = this.fb.group({
      workDate: [null, Validators.required],
      progressRate: [null, [Validators.required, Validators.min(0), Validators.max(100)]],
      workerCount: [null, [Validators.required, Validators.min(1)]],
      supervisor: ['', Validators.required],
      comment: [''],
    });
  }

  get effectiveTaskId(): string | undefined {
    return this.taskId || this.data?.taskId;
  }

  async onSubmit() {
    if (!this.form.valid || !this.effectiveTaskId) return;
    this.loading = true;
    this.error = null;
    try {
      await this.taskService.addDailyLog(this.effectiveTaskId, this.form.value);
      this.dialogRef.close('saved');
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) {
        this.error = (e as { message?: string }).message || '保存に失敗しました';
      } else {
        this.error = '保存に失敗しました';
      }
    } finally {
      this.loading = false;
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
}
