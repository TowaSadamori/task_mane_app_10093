import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators,ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/auth.service';
import { Firestore, doc, setDoc, serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { FormBuilder } from '@angular/forms';
// import { getAuth, onAuthStateChanged } from '@angular/fire/auth';


@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    RouterModule
  ],
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.scss']
})


export class UserCreateComponent implements OnInit {
  userCreateForm!: FormGroup;
  registrationError: string | null = null;
  isLoading = false;
  registrationSuccess = false;
  private authService = inject(AuthService);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  // constructor() { }

  ngOnInit(): void {
    this.userCreateForm = new FormGroup({
      'email': new FormControl('', [Validators.required, Validators.email]),
      'password': new FormControl('', [Validators.required, Validators.minLength(8)]),
      'displayName': new FormControl('', [Validators.required]),
    })
  }

  async onSubmit(): Promise<void> {
    if (this.userCreateForm.invalid) {
      this.userCreateForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.registrationError = null;
    this.registrationSuccess = false;

    const { displayName, email, password } = this.userCreateForm.value;

    try {
      // 1. Firebase Authentication でユーザー作成
      const userCredential = await this.authService.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // 2. 表示名を設定
      await this.authService.updateUserProfile(user, { displayName: displayName });

      // 3. Firestore の Users コレクションに書き込み
      const userDocRef = doc(this.firestore, `Users/${user.uid}`);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        role: 'general',
        createdAt: serverTimestamp() as Timestamp
      });

      this.snackBar.open(`アカウント「${displayName}」が正常に登録されました。ログインしてください。`, 'OK', { duration: 7000 });
      this.registrationSuccess = true;
      this.userCreateForm.reset();
      Object.keys(this.userCreateForm.controls).forEach(key => {
        this.userCreateForm.get(key)?.setErrors(null);
        this.userCreateForm.get(key)?.markAsUntouched();
        this.userCreateForm.get(key)?.markAsPristine();
      });

    } catch (error: unknown) {
      console.error('サインアップエラー:', error);
      const code = (typeof error === 'object' && error !== null && 'code' in error) ? (error as { code?: string }).code : undefined;
      this.registrationError = this.mapAuthError(code);
      this.snackBar.open(this.registrationError, '閉じる', { duration: 7000, panelClass: ['error-snackbar'] });
    } finally {
      this.isLoading = false;
    }
  }

  mapAuthError(code?: string): string {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'このメールアドレスは既に使用されています。';
      case 'auth/invalid-email':
        return '無効なメールアドレスです。';
      case 'auth/weak-password':
        return 'パスワードは6文字以上で入力してください。';
      default:
        return 'サインアップ中に予期せぬエラーが発生しました。';
    }
  }

  // async onSubmit(): Promise<void> {
  //   if (this.userCreateForm.invalid) {
  //     this.userCreateForm.markAllAsTouched();
  //     console.error('Form is invalid');
  //     return;
  //   }

  //   this.isLoading = true;
  //   this.registrationError = null;

  //   const userData = this.userCreateForm.value;

  //   this.adminUserService.createUser(userData).subscribe({
  //     next: (response) => {
  //       this.isLoading = false;
  //       console.log('ユーザー登録成功', response);
  //       alert(`ユーザー ${userData.email}を登録しました。(UID: ${response.uid})`);
  //       this.userCreateForm.reset();
  //     },
  //     error: (error) => {
  //       this.isLoading = false;
  //       console.error('ユーザー登録失敗:', error);
  //       this.registrationError = error.message || 'ユーザー登録中にエラーが発生しました。';
  //     }
  //   })
  //   console.log('Form submitted!', this.userCreateForm.value);
  // }
}

@Component({
  selector: 'app-user-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    RouterModule
  ],
  template: `
    <div class="user-settings-container">
      <h2>ユーザー設定</h2>
      <form [formGroup]="displayNameForm" (ngSubmit)="onDisplayNameSubmit()">
        <mat-form-field>
          <mat-label>表示名</mat-label>
          <input matInput formControlName="displayName">
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="displayNameForm.invalid || isLoadingDisplayName">
          表示名を変更
        </button>
      </form>
      <hr>
      <form [formGroup]="passwordForm" (ngSubmit)="onPasswordSubmit()">
        <mat-form-field>
          <mat-label>現在のパスワード</mat-label>
          <input matInput type="password" formControlName="currentPassword">
        </mat-form-field>
        <mat-form-field>
          <mat-label>新しいパスワード</mat-label>
          <input matInput type="password" formControlName="newPassword">
        </mat-form-field>
        <mat-form-field>
          <mat-label>新しいパスワード（確認）</mat-label>
          <input matInput type="password" formControlName="confirmNewPassword">
        </mat-form-field>
        <button mat-raised-button color="primary" type="submit" [disabled]="passwordForm.invalid || isLoadingPassword">
          パスワードを変更
        </button>
      </form>
    </div>
  `,
  styles: [`
    .user-settings-container { max-width: 400px; margin: 0 auto; padding: 24px; }
    mat-form-field { display: block; margin-bottom: 16px; }
    hr { margin: 32px 0; }
  `]
})
export class UserSettingsComponent implements OnInit {
  displayNameForm!: FormGroup;
  passwordForm!: FormGroup;
  isLoadingDisplayName = false;
  isLoadingPassword = false;
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  ngOnInit(): void {
    this.displayNameForm = new FormBuilder().group({
      displayName: ['', Validators.required]
    });
    this.passwordForm = new FormBuilder().group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    // 現在のユーザー情報を取得してフォームにセット
    this.authService.getCurrentUser().then(user => {
      if (user && user.displayName) {
        this.displayNameForm.patchValue({ displayName: user.displayName });
      }
    });
  }

  async onDisplayNameSubmit() {
    if (this.displayNameForm.invalid) return;
    this.isLoadingDisplayName = true;
    const displayName = this.displayNameForm.value.displayName;
    const user = await this.authService.getCurrentUser();
    if (user) {
      await this.authService.updateUserProfile(user, { displayName });
      this.snackBar.open('表示名を変更しました', 'OK', { duration: 3000 });
    }
    this.isLoadingDisplayName = false;
  }

  async onPasswordSubmit() {
    if (this.passwordForm.invalid) return;
    this.isLoadingPassword = true;
    const { currentPassword, newPassword } = this.passwordForm.value;
    const user = await this.authService.getCurrentUser();
    if (user && user.email) {
      // 再認証とパスワード変更
      await this.authService.reauthenticateAndChangePassword(user, currentPassword, newPassword);
      this.snackBar.open('パスワードを変更しました', 'OK', { duration: 3000 });
      this.passwordForm.reset();
    }
    this.isLoadingPassword = false;
  }

  passwordMatchValidator(form: FormGroup) {
    return form.get('newPassword')?.value === form.get('confirmNewPassword')?.value ? null : { mismatch: true };
  }
}
