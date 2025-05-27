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
import { Timestamp, doc, updateDoc, serverTimestamp, Firestore, getDoc } from '@angular/fire/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from '@angular/fire/storage';
import { UserService } from '../../../core/user.service';
import { ProjectService } from '../../../core/project.service';
import { GanttChartTask } from '../../../core/models/gantt-chart-task.model';
import { AuthService } from '../../../core/auth.service';

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
    comment: new FormControl(''),
    photos: new FormControl<File[]>([]),
  });

  isSaving = false;

  private dailyLogService = inject(GanttDailyLogService);
  private firestore = inject(Firestore);
  private userService = inject(UserService);
  private projectService = inject(ProjectService);
  private authService = inject(AuthService);

  managerNames = '';
  assigneeNames = '';
  existingPhotoUrls: string[] = [];

  constructor(
    private dialogRef: MatDialogRef<GanttDailyLogFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { ganttTaskId: string, log?: GanttDailyLog }
  ) {
    if (data.log) {
      this.existingPhotoUrls = data.log?.photoUrls ? [...data.log.photoUrls] : [];
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
        comment: data.log.comment || '',
      });
    }
    this.setCurrentUserAsAssignee();
    this.fetchManagerNames();
  }

  private async setCurrentUserAsAssignee() {
    const user = await this.authService.getCurrentUser();
    this.assigneeNames = user?.displayName || '';
  }

  private async fetchManagerNames() {
    if (!this.data?.ganttTaskId) return;
    const taskDocRef = doc(this.firestore, 'GanttChartTasks', this.data.ganttTaskId);
    const taskSnap = await getDoc(taskDocRef);
    if (!taskSnap.exists()) return;
    const task = taskSnap.data() as GanttChartTask;
    // プロジェクトの管理者名取得
    if (task.projectId) {
      this.projectService.getProject(task.projectId).subscribe(project => {
        if (!project) return;
        const managerIds = project.managerIds ?? (project.managerId ? [project.managerId] : []);
        if (managerIds.length > 0) {
          this.userService.getUsersByIds(managerIds).subscribe(users => {
            this.managerNames = users.map(u => u.displayName).join(', ');
          });
        }
      });
    }
  }

  async onSubmit() {
    if (this.form.valid && this.data?.ganttTaskId) {
      this.isSaving = true;
      const formValue = this.form.value;
      const photoUrls: string[] = [];
      const existingPhotoUrls: string[] = this.existingPhotoUrls;

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
        supervisor: this.assigneeNames,
        comment: formValue.comment || '',
        photoUrls: [...existingPhotoUrls, ...photoUrls]
      };
      try {
        if (this.data.log?.id) {
          // 編集時はupdate
          const logRef = doc(this.dailyLogService['firestore'], `GanttChartTasks/${this.data.ganttTaskId}/WorkLogs/${this.data.log.id}`);
          const logWithoutUpdatedAt = { ...log };
          delete logWithoutUpdatedAt.updatedAt;
          await updateDoc(logRef, { ...logWithoutUpdatedAt, updatedAt: serverTimestamp() });
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

  removeSelectedPhoto(i: number) {
    const files = this.form.get('photos')?.value as File[];
    if (Array.isArray(files)) {
      files.splice(i, 1);
      this.form.get('photos')?.setValue([...files]);
    }
  }

  removeExistingPhoto(i: number) {
    this.existingPhotoUrls.splice(i, 1);
  }
} 