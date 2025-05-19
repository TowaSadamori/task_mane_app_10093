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
import { UserService } from '../../../../../core/user.service'; // ★ 追加
import { User } from '../../../../../core/models/user.model'; // ★ 追加
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

  decisionMakers: User[] = [];
  projectMembers: User[] = [];
  private userService = inject(UserService);

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddTaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TaskDialogData | null
  ) {
    this.taskForm = this.fb.group({
      title: ['', Validators.required], // 'taskName'→'title'に変更
      plannedStartDate: [null, Validators.required],
      plannedEndDate: [null, Validators.required],
      assigneeId: ['', Validators.required],
      status: ['todo', Validators.required],
      dueDate: [null],
      category: [''],
      decisionMakerId: ['']
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
        title: this.data.task.title, // 'taskName'→'title'
        plannedStartDate: this.data.task.plannedStartDate,
        plannedEndDate: this.data.task.plannedEndDate,
        assigneeId: this.data.task.assigneeId,
        status: this.data.task.status || 'todo',
        dueDate: this.data.task.dueDate,
        category: this.data.task.category,
        decisionMakerId: this.data.task.decisionMakerId
      });
    }
  }

  ngOnInit(): void {
    console.log('AddTaskDialogComponent initialized. isEditMode:', this.isEditMode, 'TaskData:', this.data?.task, 'ProjectID:', this.projectId);
  
    // 意思決定者リストを取得
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.decisionMakers = users;
        console.log('Decision makers loaded:', this.decisionMakers);
      },
      error: (err) => {
        console.error('Error loading decision makers:', err);
      }
    });
  
    // ★ プロジェクトメンバーリストを取得
    if (this.projectId) {
      this.projectService.getProject(this.projectId).subscribe({
        next: (project) => {
          console.log('Fetched project details:', project);
          if (project && project.members && project.members.length > 0) {
            this.userService.getUsersByIds(project.members).subscribe({
              next: (members) => {
                this.projectMembers = members;
                console.log('Project members loaded for project', this.projectId, ':', this.projectMembers);
              },
              error: (err) => {
                console.error('Error loading project members:', err);
                this.projectMembers = []; // エラー時は空にする
              }
            });
          } else {
            console.warn('Project not found or has no members for projectId:', this.projectId);
            this.projectMembers = []; // プロジェクトがないかメンバーがいない場合は空にする
          }
        },
        error: (err) => {
          console.error('Error loading project details:', err);
          this.projectMembers = []; // エラー時は空にする
        }
      });
    } else {
      console.warn('No projectId provided to load project members.');
      this.projectMembers = []; // projectIdがない場合は空にする
    }
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
        assigneeId: formData.assigneeId,
        status: formData.status,
        dueDate: formData.dueDate,
        category: formData.category,
        decisionMakerId: formData.decisionMakerId
      };
      this.dialogRef.close(resultData);
    }
  }
}