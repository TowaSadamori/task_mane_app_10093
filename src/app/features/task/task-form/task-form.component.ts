import { Component, OnInit, inject, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TaskService, Task } from '../../../core/task.service';
// import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';


@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    // MatSnackBarModule,
  ],
  templateUrl: './task-form.component.html',
  styleUrl: './task-form.component.scss'
})

export class TaskFormComponent implements OnInit {
  taskForm!: FormGroup;
  formError: string | null = null;
  isLoading = false;
  private taskService = inject(TaskService);
  initialData?: Task | null;

  constructor(
    private dialogRef: MatDialogRef<TaskFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: Task | null
  ) {
    if (data) {
      this.initialData = data;
    }
   }

  ngOnInit(): void {
    this.taskForm = new FormGroup({
      'title': new FormControl('', [Validators.required]),
      'projectId': new FormControl('', [Validators.required]),
      'assigneeId': new FormControl('', [Validators.required]),
      'status': new FormControl('todo', [Validators.required]),
      'plannedStartDate': new FormControl<Date | null>(null, [Validators.required]),
      'plannedEndDate': new FormControl<Date | null>(null, [Validators.required]),
      'description': new FormControl(''),
  });

  if (this.initialData) {
    this.taskForm.patchValue(this.initialData);
    console.log('編集モード: フォームに初期値を設定しました', this.initialData);
  }
}


 async onSubmit():Promise <void> {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      console.error('Form is invalid');
      this.formError = '入力内容に誤りがあります。';
      return;
    }

    this.isLoading = true;
    this.formError = null;

    const taskData = this.taskForm.value;

    try {
      if (this.initialData?.id) {
        await this.taskService.updateTask(this.initialData.id, taskData);
        console.log('タスク更新成功: ID:', this.initialData.id);
        this.dialogRef.close('saved');
        
      } else {
        const docRef = await this.taskService.createTask(taskData);
        console.log('タスク作成成功: Document written with ID:', docRef.id);
        alert(`タスク「${taskData.title}」作成しました！(ID: ${docRef.id})`);
        this.taskForm.reset({ status: 'todo' });
        this.dialogRef.close('created');
      }

    } catch (error:unKnown) {
      let errorMessage = 'タスクの処理中にエラーが発生しました。';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      this.formError = errorMessage;
    } finally {
      this.isLoading = false;
    }
  }


}
