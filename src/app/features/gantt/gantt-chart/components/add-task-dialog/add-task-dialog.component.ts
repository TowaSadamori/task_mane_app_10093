import { Component, Inject, OnInit, inject } from '@angular/core'; // OnInit を追加
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; 
import { GanttTaskDisplayItem } from '../../../../../core/project.service';
import { MatSelectModule } from '@angular/material/select';
import { UserService } from '../../../../../core/user.service'; // ★ 追加
import { User } from '../../../../../core/models/user.model'; // ★ 追加
import { ProjectService } from '../../../../../core/project.service'; // ★ 追加



export interface TaskDialogData { 
  task?: GanttTaskDisplayItem;  
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

 // decisionMakers プロパティの型を User[] に変更し、初期値を空配列に
decisionMakers: User[] = []; // ★ 変更 (ダミーデータは削除)

// projectMembers も同様に型定義だけしておく (実際のデータ取得は次のステップ)
projectMembers: User[] = []; // ★ 変更 (ダミーデータは削除)

private userService = inject(UserService); // ★ UserService をインジェクト

  constructor(
    private fb: FormBuilder, // FormBuilder を注入
    public dialogRef: MatDialogRef<AddTaskDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TaskDialogData | null
  ) {

    this.taskForm = this.fb.group({
      taskName: ['', Validators.required],
      plannedStartDate: [null, Validators.required],
      plannedEndDate: [null, Validators.required],
      assigneeId: ['', Validators.required], // ★ 追加: 担当者ID (必須入力)
      dueDate: [null],                       // ★ 追加: ToDo期限 (任意入力)
      category: [''],                       // ★ 追加: カテゴリ (任意入力、初期値は空文字)
      decisionMakerId: ['']                  // ★ 追加: 意思決定者ID (任意入力、初期値は空文字)
    });

    if (this.data) {
      this.isEditMode = this.data.isEditMode;
      // ここで projectId を this.projectId に代入するロジックが必要
      if (this.data.projectId) { // このようなチェックと代入が期待されます
          this.projectId = this.data.projectId;
      } else if (!this.isEditMode) {
          console.error('プロジェクトIDがダイアログに渡されていません。');
          // エラー処理
      }
    }

    

    if (this.data) { // ★ data が存在する場合の初期設定
      this.isEditMode = this.data.isEditMode;
      if (this.isEditMode && this.data.task) {
        this.dialogTitle = 'タスク編集';
        this.submitButtonText = '更新';
        // フォームに初期値を設定
        this.taskForm.patchValue({
          taskName: this.data.task.name, // `GanttTaskDisplayItem` の `name` は `Task` の `title` に対応
          plannedStartDate: this.data.task.plannedStartDate,
          plannedEndDate: this.data.task.plannedEndDate,
          assigneeId: this.data.task.assigneeId,         // ★ 追加
          dueDate: this.data.task.dueDate,               // ★ 追加
          category: this.data.task.category,             // ★ 追加
          decisionMakerId: this.data.task.decisionMakerId  // ★ 追加
        });
      }
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

  // フォーム送信時の処理（今回はまだ呼ばれないが、将来的に「追加」ボタンから呼ぶ）
  onSubmit(): void {
    if (this.taskForm.valid) {
      this.dialogRef.close(this.taskForm.value); // フォームの値を親コンポーネントに渡す
    }
  }
}