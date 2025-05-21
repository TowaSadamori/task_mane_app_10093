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
import { Timestamp, doc, updateDoc } from '@angular/fire/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';

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
    photos: new FormControl<File[]>([]),
  });

  isSaving = false;

  private dailyLogService = inject(GanttDailyLogService);

  constructor(
    private dialogRef: MatDialogRef<GanttDailyLogFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { ganttTaskId: string, log?: GanttDailyLog }
  ) {
    if (data.log) {
      this.form.patchValue({
        workDate:
          data.log.workDate && typeof data.log.workDate.toDate === 'function'
            ? data.log.workDate.toDate()
            : (data.log.workDate instanceof Date ? data.log.workDate : null),
        actualStartTime: data.log.actualStartTime,
        actualEndTime: data.log.actualEndTime,
        actualBreakTime: data.log.actualBreakTime,
        progressRate: data.log.progressRate,
        workerCount: data.log.workerCount,
        supervisor: data.log.supervisor,
        comment: data.log.comment || '',
      });
    }
  }

  async onSubmit() {
    if (this.form.valid && this.data?.ganttTaskId) {
      this.isSaving = true;
      const formValue = this.form.value;
      const photoUrls: string[] = [];
      const existingPhotoUrls: string[] = this.data.log?.photoUrls || [];

      const photoFiles = formValue.photos as File[];
      if (photoFiles && photoFiles.length > 0) {
        const storage = getStorage();
        for (const photoFile of photoFiles) {
          const storageRef = ref(storage, `gantt-daily-logs/${this.data.ganttTaskId}/${Date.now()}_${photoFile.name}`);
          await uploadBytes(storageRef, photoFile);
          const url = await getDownloadURL(storageRef);
          photoUrls.push(url);
        }
      }

      const log: GanttDailyLog = {
        ...(this.data.log || {}),
        workDate: Timestamp.fromDate(formValue.workDate!),
        actualStartTime: formValue.actualStartTime!,
        actualEndTime: formValue.actualEndTime!,
        actualBreakTime: formValue.actualBreakTime!,
        progressRate: formValue.progressRate!,
        workerCount: formValue.workerCount!,
        supervisor: formValue.supervisor!,
        comment: formValue.comment || '',
        photoUrls: [...existingPhotoUrls, ...photoUrls]
      };
      try {
        if (this.data.log?.id) {
          // 編集時はupdate
          const logRef = doc(this.dailyLogService['firestore'], `GanttChartTasks/${this.data.ganttTaskId}/WorkLogs/${this.data.log.id}`);
          await updateDoc(logRef, log as Partial<GanttDailyLog>);
        } else {
          // 新規作成
          await this.dailyLogService.addDailyLog(this.data.ganttTaskId, log);
        }
        this.isSaving = false;
        this.dialogRef.close(log);
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
    const files = input.files ? Array.from(input.files) : [];
    this.form.get('photos')?.setValue(files);
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

  removeExistingPhoto(i: number) {
    if (this.data.log && Array.isArray(this.data.log.photoUrls)) {
      this.data.log.photoUrls.splice(i, 1);
    }
  }
} 