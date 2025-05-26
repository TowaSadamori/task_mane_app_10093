import { Component, Inject, OnInit, inject } from '@angular/core'; // OnInit を追加
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; 
import { ProjectService } from '../../../../../core/project.service';
import { MatSelectModule } from '@angular/material/select';
import { GanttChartTask } from '../../../../../core/models/gantt-chart-task.model';
import { GanttDailyLogService } from '../../../gantt-daily-log-form-dialog/gantt-daily-log.service';
import { Timestamp } from '@angular/fire/firestore';
import { UserService } from '../../../../../core/user.service';

export interface TaskDialogData { 
  task?: GanttChartTask;  // 型をGanttChartTaskに変更
  isEditMode: boolean; 
  projectId: string;         
  minDate?: string | null;
  maxDate?: string | null;
}

@Component({
  selector: 'app-add-task-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, 
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule, 
    MatInputModule,     
    MatDatepickerModule, 
    MatNativeDateModule,
    MatSelectModule,
  ],
  templateUrl: './add-task-dialog.component.html',
  styleUrls: ['./add-task-dialog.component.scss']
})

export class AddTaskDialogComponent implements OnInit { 
  taskForm: FormGroup;
  isEditMode = false; 
  dialogTitle = 'タスク追加'; 
  submitButtonText = '追加';
  private projectId!: string; 
  private projectService = inject(ProjectService); 
  public minDate: string | null = null;
  public maxDate: string | null = null;
  statusDisabled = false;
  private dailyLogService = inject(GanttDailyLogService);
  private userService = inject(UserService);
  managerDisplayNames = '';

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddTaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TaskDialogData | null
  ) {
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      plannedStartDate: [null, Validators.required],
      plannedEndDate: [null, Validators.required],
      actualStartDate: [null],
      actualEndDate: [null],
      status: ['todo', Validators.required],
      memo: ['']
    }, { validators: [plannedEndDateAfterOrEqualStartDateValidator, plannedDateWithinProjectPeriodValidator(this.minDate, this.maxDate)] });

    if (this.data) {
      this.isEditMode = this.data.isEditMode;
      if (this.data.projectId) {
        this.projectId = this.data.projectId;
      } else if (!this.isEditMode) {
        console.error('プロジェクトIDがダイアログに渡されていません。');
      }
      this.minDate = this.data.minDate ?? null;
      this.maxDate = this.data.maxDate ?? null;
    }

    if (this.data && this.isEditMode && this.data.task) {
      this.dialogTitle = 'タスク編集';
      this.submitButtonText = '更新';
      this.taskForm.patchValue({
        title: this.data.task.title,
        plannedStartDate: this.toDateStringOrNull(this.data.task.plannedStartDate),
        plannedEndDate: this.toDateStringOrNull(this.data.task.plannedEndDate),
        actualStartDate: this.toDateStringOrNull(this.data.task.actualStartDate),
        actualEndDate: this.toDateStringOrNull(this.data.task.actualEndDate),
        status: this.data.task.status || 'todo',
        memo: this.data.task.memo
      });
      this.statusDisabled = false;
    }
  }

  ngOnInit(): void {
    console.log('AddTaskDialogComponent initialized. isEditMode:', this.isEditMode, 'TaskData:', this.data?.task, 'ProjectID:', this.projectId);
    // 管理者名の取得
    if (this.projectId) {
      this.projectService.getProject(this.projectId).subscribe(project => {
        if (!project) return;
        const managerIds = project.managerIds ?? (project.managerId ? [project.managerId] : []);
        if (managerIds.length > 0) {
          this.userService.getUsersByIds(managerIds).subscribe(users => {
            this.managerDisplayNames = users.map(u => u.displayName).join(', ');
          });
        }
      });
    }
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.taskForm.valid) {
      const formData = this.taskForm.value;
      const toTimestampOrUndefined = (val: unknown) => {
        if (!val) return undefined;
        if (val instanceof Date) {
          return isNaN(val.getTime()) ? undefined : Timestamp.fromDate(val);
        }
        if (typeof val === 'string' || typeof val === 'number') {
          const date = new Date(val);
          return isNaN(date.getTime()) ? undefined : Timestamp.fromDate(date);
        }
        if (typeof val === 'object' && val !== null && typeof (val as { toDate?: unknown }).toDate === 'function') {
          const date = (val as { toDate: () => Date }).toDate();
          return isNaN(date.getTime()) ? undefined : Timestamp.fromDate(date);
        }
        return undefined;
      };
      const resultData: Partial<GanttChartTask> = {
        title: formData.title,
        plannedStartDate: toTimestampOrUndefined(formData.plannedStartDate),
        plannedEndDate: toTimestampOrUndefined(formData.plannedEndDate),
        actualStartDate: toTimestampOrUndefined(formData.actualStartDate),
        actualEndDate: toTimestampOrUndefined(formData.actualEndDate),
        status: formData.status,
        memo: formData.memo
      };
      this.dialogRef.close(resultData);
    }
  }

  private toDateStringOrNull(value: unknown): string | null {
    let date: Date | null = null;
    if (!value) return null;
    if (value instanceof Date) date = value;
    else if (this.isTimestamp(value)) date = value.toDate();
    else if (typeof value === 'string' && !isNaN(Date.parse(value))) date = new Date(value);
    if (!date) return null;
    return date.toISOString().slice(0, 10);
  }

  private isTimestamp(value: unknown): value is { toDate: () => Date } {
    return !!value && typeof (value as { toDate?: unknown }).toDate === 'function';
  }
}

function plannedEndDateAfterOrEqualStartDateValidator(group: FormGroup) {
  const start = group.get('plannedStartDate')?.value;
  const end = group.get('plannedEndDate')?.value;
  if (start && end && end < start) {
    return { plannedEndDateBeforeStartDate: true };
  }
  return null;
}

function plannedDateWithinProjectPeriodValidator(minDate: string | null, maxDate: string | null) {
  return (group: FormGroup) => {
    const start = group.get('plannedStartDate')?.value;
    const end = group.get('plannedEndDate')?.value;
    const errors: Record<string, boolean> = {};
    if (minDate) {
      if (start && start < minDate) {
        errors['plannedStartDateBeforeProject'] = true;
      }
      if (end && end < minDate) {
        errors['plannedEndDateBeforeProject'] = true;
      }
    }
    if (maxDate) {
      if (start && start > maxDate) {
        errors['plannedStartDateAfterProject'] = true;
      }
      if (end && end > maxDate) {
        errors['plannedEndDateAfterProject'] = true;
      }
    }
    return Object.keys(errors).length ? errors : null;
  };
}