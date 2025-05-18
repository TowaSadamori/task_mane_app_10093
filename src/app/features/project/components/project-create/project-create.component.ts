import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms'; // ReactiveFormsModule をインポート
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProjectService, NewProjectData } from '../../../../core/project.service';
import { AuthService } from '../../../../core/auth.service'; // AuthService のパスを確認
import { User } from '@angular/fire/auth'; // Firebase User型

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // ReactiveFormsModule を追加
  templateUrl: './project-create.component.html',
  styleUrls: ['./project-create.component.scss']
})
export class ProjectCreateComponent implements OnInit {
  projectForm: FormGroup;
  isLoading = false;
  currentUser: User | null = null; // ログインユーザー情報

  private fb: FormBuilder = inject(FormBuilder);
  private projectService: ProjectService = inject(ProjectService);
  private router: Router = inject(Router);
  private authService: AuthService = inject(AuthService); // AuthServiceをインジェクト

  constructor() {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      // startDate: [null], // 日付ピッカーなどを使う場合は別途設定
      // endDate: [null],
      // status: ['active', Validators.required] // デフォルト値を設定
    });
  }

  ngOnInit(): void {
    // ログインユーザー情報を取得（managerId として使用するため）
    this.authService.authState$.subscribe((user: User | null) => {
      this.currentUser = user;
    });
  }

  get name() { return this.projectForm.get('name'); }
  get description() { return this.projectForm.get('description'); }

  async onSubmit(): Promise<void> {
    if (this.projectForm.invalid || !this.currentUser) {
      this.projectForm.markAllAsTouched(); // 未入力フィールドにエラー表示を促す
      if (!this.currentUser) {
        console.error('ユーザーがログインしていません。');
        // ここでユーザーにエラーメッセージを表示する処理を追加できます
      }
      return;
    }

    this.isLoading = true;
    const formValue = this.projectForm.value;

    const newProjectData: NewProjectData = {
      name: formValue.name,
      description: formValue.description,
      managerId: this.currentUser.uid, // ログインユーザーのIDをマネージャーとして設定
      // startDate: formValue.startDate ? new Date(formValue.startDate) : null,
      // endDate: formValue.endDate ? new Date(formValue.endDate) : null,
      status: 'active', // デフォルトステータス
      // members: [this.currentUser.uid] // 作成者をメンバーに追加する例
    };

    try {
      await this.projectService.createProject(newProjectData);
      console.log('プロジェクトが正常に作成されました。');
      this.router.navigate(['/app/dashboard']); // ダッシュボードにリダイレクト
    } catch (error) {
      console.error('プロジェクト作成エラー:', error);
      // ここでユーザーにエラーメッセージを表示する処理を追加できます
    } finally {
      this.isLoading = false;
    }
  }

  onCancel(): void {
    this.router.navigate(['/app/dashboard']); // ダッシュボードに戻る
  }
}
