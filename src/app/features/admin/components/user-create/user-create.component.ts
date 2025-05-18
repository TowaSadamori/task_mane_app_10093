// src/app/features/admin/components/user-create/user-create.component.ts
import { Component, OnInit, inject, Input, OnChanges, SimpleChanges } from '@angular/core'; // ★ Input, OnChanges, SimpleChanges をインポート
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms'; // ★ ValidatorFn, AbstractControl, ValidationErrors をインポート
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
// import { MatSelectModule } from '@angular/material/select'; // role を使わないのであれば不要
import { MatButtonModule } from '@angular/material/button';
// import { AdminUserService, CreateUserResponse } from '../../services/admin-user.service'; // ★ AdminUserService は編集モードでは使わない
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { UserService } from '../../../../core/user.service';
import { User as FirebaseUser } from '@angular/fire/auth';
import { User as AppUser } from '../../../../core/models/user.model'; 
import { firstValueFrom } from 'rxjs'; // ★ firstValueFrom をインポート

// パスワード一致バリデータ関数
export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  return password && confirmPassword && password.value !== confirmPassword.value ? { passwordMismatch: true } : null;
};

@Component({
  selector: 'app-user-create', // このセレクタを UserSettingsComponent の HTML で使用します
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    // MatSelectModule, // role を使わないのであれば不要
    MatButtonModule,
    MatSnackBarModule,
  ],
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.scss'] // styleUrl に修正
})


export class UserCreateComponent implements OnInit, OnChanges { // ★ OnChanges を実装
  @Input() isEditMode = false;
  @Input() userIdToEdit: string | null = null;

  userCreateForm!: FormGroup;
  feedbackMessage: string | null = null; // registrationError から feedbackMessage に変更
  isLoading = false;

  // private adminUserService = inject(AdminUserService); // ★ 編集モードでは使わないのでコメントアウト
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private authService = inject(AuthService);
  private userService = inject(UserService);

  formTitle = 'ユーザー登録';
  submitButtonText = '登録';

  ngOnInit(): void {
    this.initializeForm();
    if (this.isEditMode && this.userIdToEdit) {
      this.loadUserDataForEdit();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isEditMode'] || changes['userIdToEdit']) {
      this.initializeForm();
      if (this.isEditMode && this.userIdToEdit) {
        this.loadUserDataForEdit();
      }
    }
  }

  private initializeForm(): void {
    this.formTitle = this.isEditMode ? 'ユーザー情報更新' : 'ユーザー登録';
    this.submitButtonText = this.isEditMode ? '更新' : '登録';

    this.userCreateForm = new FormGroup({
      email: new FormControl({ value: '', disabled: this.isEditMode }, [Validators.required, Validators.email]),
      password: new FormControl('', this.isEditMode ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)]),
      confirmPassword: new FormControl('', this.isEditMode ? [] : [Validators.required]),
      displayName: new FormControl('', [Validators.required]),
    });

    if (!this.isEditMode) {
      // 新規登録時のみパスワード一致バリデータをフォーム全体に設定
      this.userCreateForm.addValidators(passwordMatchValidator);
    } else {
      // 編集モードでパスワードが入力された場合のみ確認パスワードを必須にし、一致を検証
      this.userCreateForm.get('password')?.valueChanges.subscribe(value => {
        const confirmPasswordControl = this.userCreateForm.get('confirmPassword');
        if (value) {
          confirmPasswordControl?.setValidators([Validators.required, passwordMatchValidator]);
        } else {
          confirmPasswordControl?.clearValidators();
        }
        confirmPasswordControl?.updateValueAndValidity();
      });
      // 編集モードではフォーム全体の passwordMatchValidator は不要なので削除 (個別フィールドで対応)
      this.userCreateForm.clearValidators();
      // ただし、パスワードが入力されたら confirmPassword との一致を見る必要があるため、
      // confirmPassword 側のバリデータで passwordMatchValidator を呼び出す形にするか、
      // password フィールドの valueChanges で動的に confirmPassword のバリデータを設定する。
      // ここでは confirmPassword に passwordMatchValidator を適用し、password 入力時に必須化する。
      this.userCreateForm.setValidators((group: AbstractControl): ValidationErrors | null => {
        if (this.isEditMode && !group.get('password')?.value) {
          // 編集モードでパスワードが入力されていなければ、パスワード一致の検証は不要
          return null;
        }
        // 新規登録モード、または編集モードでパスワードが入力されていれば、一致を検証
        return passwordMatchValidator(group);
      });
    }
    this.userCreateForm.updateValueAndValidity();
  }

  private async loadUserDataForEdit(): Promise<void> {
    this.feedbackMessage = null;
    const currentUser: FirebaseUser | null = this.authService.getCurrentUser();
  
    console.log('[UserSettings] loadUserDataForEdit - currentUser from AuthService:', currentUser);
    console.log('[UserSettings] loadUserDataForEdit - userIdToEdit:', this.userIdToEdit);
  
    if (currentUser && currentUser.uid === this.userIdToEdit) {
      this.userCreateForm.patchValue({ email: currentUser.email });
      console.log('[UserSettings] Patched email from Auth:', currentUser.email);
  
      try {
        console.log(`[UserSettings] Attempting to get Firestore user data for UID: ${this.userIdToEdit}`);
        const appUser: AppUser | null = await firstValueFrom(this.userService.getUser(this.userIdToEdit!));
        console.log('[UserSettings] Firestore appUser data received:', appUser); // ★ userService.getUser() の結果をログ出力
  
        if (appUser && typeof appUser.displayName === 'string') { // ★ appUser の存在と displayName の型をチェック
          this.userCreateForm.patchValue({ displayName: appUser.displayName });
          console.log('[UserSettings] Patched displayName from Firestore:', appUser.displayName);
        } else if (appUser && !appUser.displayName) {
          // Firestoreにドキュメントはあるが、displayNameがない場合
          this.userCreateForm.patchValue({ displayName: currentUser.displayName || '' });
          console.warn('[UserSettings] Firestoreにユーザー情報はあるものの、displayName が存在しません。Authの表示名を使用します。appUser:', appUser);
          this.feedbackMessage = '表示名が設定されていません。'; // 必要ならメッセージ変更
        }
        else { // appUser が null の場合 (Firestoreにドキュメントがない)
          this.userCreateForm.patchValue({ displayName: currentUser.displayName || '' });
          console.warn('[UserSettings] Firestoreにユーザー情報が見つかりませんでした (appUser is null)。Authの表示名を使用します。');
          this.feedbackMessage = 'ユーザー情報を読み込めませんでした（詳細情報なし）。'; // より具体的なメッセージ
        }
      } catch (error: unknown) { // ★ error の型を unknown に
        console.error('[UserSettings] Firestoreからのユーザー情報取得に失敗:', error); // ★ エラーオブジェクト全体をログ出力
  
        // エラーメッセージの整形 (前回提案した形)
        let specificErrorMessage = 'ユーザー情報の読み込み中にエラーが発生しました。';
        if (error instanceof Error) {
          specificErrorMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
          specificErrorMessage = (error as { message: string }).message;
        } else if (typeof error === 'string') {
          specificErrorMessage = error;
        }
        this.feedbackMessage = specificErrorMessage;
  
        this.userCreateForm.patchValue({ displayName: currentUser.displayName || '' }); // フォールバック
        console.log('[UserSettings] Fallback: Patched displayName from Auth due to error:', currentUser.displayName);
      }
    } else {
      if (!currentUser) {
        console.error('[UserSettings] 編集対象のユーザー情報が取得できません (currentUser is null)。');
        this.feedbackMessage = 'ログイン情報が取得できません。再ログインしてください。';
      } else if (currentUser.uid !== this.userIdToEdit) {
        console.error(`[UserSettings] 編集対象のユーザーIDが一致しません。Auth UID: ${currentUser.uid}, userIdToEdit: ${this.userIdToEdit}`);
        this.feedbackMessage = '編集対象のユーザー情報が正しくありません。';
      }
      this.router.navigate(['/app/dashboard']);
    }
  }

  async onSubmit(): Promise<void> {
    // ... (前回の onSubmit のコード、エラー処理は修正済み) ...
    if (this.userCreateForm.invalid) {
      this.userCreateForm.markAllAsTouched();
      console.error('Form is invalid');
      this.feedbackMessage = '入力内容に誤りがあります。';
      return;
    }

    this.isLoading = true;
    this.feedbackMessage = null;
    const formValue = this.userCreateForm.value;

    if (this.isEditMode) {
      if (!this.userIdToEdit) {
        this.isLoading = false;
        this.feedbackMessage = '更新対象のユーザーIDが不明です。';
        return;
      }
      try {
        // 表示名の更新
        if (this.userCreateForm.get('displayName')?.dirty) {
          await this.authService.updateUserProfile({ displayName: formValue.displayName });
          // ★ UserService の updateUser に渡すデータは AppUser の型に合わせる
          const updateData: Partial<AppUser> = { displayName: formValue.displayName };
          await this.userService.updateUser(this.userIdToEdit, updateData);
          console.log('表示名を更新しました。');
        }

        // パスワードの更新
        if (formValue.password) {
          // (パスワード一致の再確認はバリデータに任せるか、ここでも行うか)
          // if (formValue.password !== formValue.confirmPassword) { ... }
          await this.authService.updateUserPassword(formValue.password);
          console.log('パスワードを更新しました。');
        }

        this.isLoading = false;
        this.snackBar.open('ユーザー情報を更新しました。', '閉じる', { duration: 3000 });

      } catch (error: unknown) {
        this.isLoading = false;
        console.error('ユーザー情報更新失敗:', error);
        if (error instanceof Error) {
          this.feedbackMessage = error.message;
        } else if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
          this.feedbackMessage = (error as { message: string }).message;
        } else if (typeof error === 'string') {
          this.feedbackMessage = error;
        } else {
          this.feedbackMessage = 'ユーザー情報の更新中に予期せぬエラーが発生しました。';
        }
      }
    } else {
      // 新規登録処理 (今回は対象外)
      console.warn('新規登録モードでの送信は、管理者機能として別途実装してください。');
      this.isLoading = false;
      this.feedbackMessage = 'このフォームは現在ユーザー情報更新専用です。';
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }
}