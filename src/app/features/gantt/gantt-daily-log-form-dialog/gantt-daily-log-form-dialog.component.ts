import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { GanttDailyLogService, GanttDailyLog } from './gantt-daily-log.service';
import { Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-gantt-daily-log-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl: './gantt-daily-log-form-dialog.component.html',
  styleUrls: ['./gantt-daily-log-form-dialog.component.scss'],
})
export class GanttDailyLogFormDialogComponent {
  form = new FormGroup({
    workDate: new FormControl<Date | null>(null, Validators.required),
    actualStartTime: new FormControl('', Validators.required),
    actualEndTime: new FormControl('', Validators.required),
    actualBreakTime: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    progressRate: new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    workerCount: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    supervisor: new FormControl('', Validators.required),
    comment: new FormControl(''),
    photo: new FormControl<File | null>(null),
  });

  isSaving = false;

  private dailyLogService = inject(GanttDailyLogService);

  constructor(
    private dialogRef: MatDialogRef<GanttDailyLogFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { ganttTaskId: string }
  ) {}

  async onSubmit() {
    if (this.form.valid && this.data?.ganttTaskId) {
      this.isSaving = true;
      const formValue = this.form.value;
      const log: GanttDailyLog = {
        workDate: Timestamp.fromDate(formValue.workDate!),
        actualStartTime: formValue.actualStartTime!,
        actualEndTime: formValue.actualEndTime!,
        actualBreakTime: formValue.actualBreakTime!,
        progressRate: formValue.progressRate!,
        workerCount: formValue.workerCount!,
        supervisor: formValue.supervisor!,
        comment: formValue.comment || ''
        // photoUrl, createdAtはaddDailyLog側で付与
      };
      // ここでganttTaskIdとlogを出力
      console.log('ganttTaskId:', this.data.ganttTaskId);
      console.log('log:', log);
      try {
        // 必要なフィールドだけを渡す
        await this.dailyLogService.addDailyLog(this.data.ganttTaskId, log);
        this.isSaving = false;
        this.dialogRef.close(log); // 保存したデータを返す
      } catch {
        this.isSaving = false;
        alert('保存に失敗しました');
      }
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.form.get('photo')?.setValue(input.files && input.files[0] ? input.files[0] : null);
  }

  async deleteDailyLog(logId: string) {
    try {
      await this.dailyLogService.deleteDailyLog(this.data.ganttTaskId, logId);
      this.dialogRef.close();
    } catch (error) {
      console.error('削除に失敗しました', error);
      alert('削除に失敗しました');
    }
  }
} 