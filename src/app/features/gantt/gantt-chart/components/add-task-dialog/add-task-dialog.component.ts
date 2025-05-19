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

export interface TaskDialogData { 
  task?: GanttChartTask;  // 型をGanttChartTaskに変更
  isEditMode: boolean; 
  projectId: string;         
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
    });

    if (this.data) {
      this.isEditMode = this.data.isEditMode;
      if (this.data.projectId) {
        this.projectId = this.data.projectId;
      } else if (!this.isEditMode) {
        console.error('プロジェクトIDがダイアログに渡されていません。');
      }
    }

    if (this.data && this.isEditMode && this.data.task) {
      this.dialogTitle = 'タスク編集';
      this.submitButtonText = '更新';
      this.taskForm.patchValue({
        title: this.data.task.title,
        plannedStartDate: this.data.task.plannedStartDate,
        plannedEndDate: this.data.task.plannedEndDate,
        actualStartDate: this.data.task.actualStartDate || null,
        actualEndDate: this.data.task.actualEndDate || null,
        status: this.data.task.status || 'todo',
        memo: this.data.task.memo
      });
    }
  }

  ngOnInit(): void {
    console.log('AddTaskDialogComponent initialized. isEditMode:', this.isEditMode, 'TaskData:', this.data?.task, 'ProjectID:', this.projectId);
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.taskForm.valid) {
      const formData = this.taskForm.value;
      const resultData: Partial<GanttChartTask> = {
        title: formData.title,
        plannedStartDate: formData.plannedStartDate,
        plannedEndDate: formData.plannedEndDate,
        actualStartDate: formData.actualStartDate,
        actualEndDate: formData.actualEndDate,
        status: formData.status,
        memo: formData.memo
      };
      this.dialogRef.close(resultData);
    }
  }
}