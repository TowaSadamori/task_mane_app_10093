import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ProjectService, NewProjectData } from '../../../../core/project.service';
import { UserService } from '../../../../core/user.service';
import { User } from '../../../../core/models/user.model';
import { Timestamp } from '@angular/fire/firestore'; // ★ コメントアウト解除
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'; // ★ MatSnackBarModule をインポート
// 不要なインポートは削除済みとします

@Component({
  selector: 'app-project-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatDatepickerModule, MatNativeDateModule, MatSelectModule,
    MatIconModule,
    MatSnackBarModule // ★ 追加
  ],
  templateUrl: './project-form.component.html',
  styleUrls: ['./project-form.component.scss']
})
export class ProjectFormComponent implements OnInit {
  projectForm!: FormGroup;
  isLoading = false;
  users: User[] = []; // メンバー選択用

  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  // TODO: 現在のログインユーザーIDを取得する AuthServic


  // ... (上記の続き) ...

  ngOnInit(): void {
    // プロジェクトフォームの定義
    this.projectForm = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.minLength(3)]),
      description: new FormControl(''),
      startDate: new FormControl<Date | null>(null), // 予定開始日
      endDate: new FormControl<Date | null>(null),   // 予定終了日
      managerId: new FormControl('', [Validators.required]), // 管理者ID (必須)
      members: new FormArray([]) // プロジェクトメンバーのIDリスト (任意選択)
    });

    // ユーザーリストを取得して、管理者選択とメンバー選択のドロップダウンに使用
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.getUsers().subscribe(
      (users) => {
        this.users = users;
        console.log('Users loaded for project form select:', this.users);
      },
      (error) => {
        console.error('Error loading users for project form:', error);
        this.snackBar.open('ユーザーリストの読み込みに失敗しました。', '閉じる', { duration: 3000 });
      }
    );
  }

  // members FormArray を取得するためのゲッター
  get membersFormArray(): FormArray {
    return this.projectForm.get('members') as FormArray;
  }

  // 新しいメンバー選択コントロールを FormArray に追加するメソッド
  addMemberControl(): void {
    this.membersFormArray.push(new FormControl('')); // 初期値は空、バリデーションは任意
    // 必要であれば、追加時に選択可能なユーザーリストを絞り込むなどのロジック
  }

  // 指定されたインデックスのメンバー選択コントロールを FormArray から削除するメソッド
  removeMemberControl(index: number): void {
    this.membersFormArray.removeAt(index);
  }

  async onSubmit(): Promise<void> {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      this.snackBar.open('入力内容に誤りがあります。確認してください。', '閉じる', { duration: 3000, panelClass: ['error-snackbar'] });
      return;
    }

    this.isLoading = true;
    const formValue = this.projectForm.value;
    const memberIds = (formValue.members as string[]).filter(id => id && id.trim() !== '');

    const newProjectData: NewProjectData = {
      name: formValue.name,
      description: formValue.description || '',
      startDate: formValue.startDate ? Timestamp.fromDate(formValue.startDate) : null, // Timestampに変換
      endDate: formValue.endDate ? Timestamp.fromDate(formValue.endDate) : null,       // Timestampに変換
      managerId: formValue.managerId,
      members: memberIds,
      status: 'active',
    };

    try {
      await this.projectService.createProject(newProjectData);
      this.snackBar.open(`プロジェクト「${newProjectData.name}」を登録しました。`, '閉じる', { duration: 3000 });
      this.projectForm.reset();
      this.router.navigate(['/app/dashboard']);
    } catch (error) {
      let errorMessage = 'プロジェクトの作成に失敗しました。';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      this.snackBar.open(errorMessage, '閉じる', { duration: 7000, panelClass: ['error-snackbar'] });
    } finally {
      this.isLoading = false;
    }
  }

  navigateToDashboard(): void {
    this.router.navigate(['/app/dashboard']);
  }

}