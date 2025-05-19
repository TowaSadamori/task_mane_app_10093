
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth.service'; // パスは実際のプロジェクト構造に合わせてください
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
    RouterModule,
    MatDividerModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './user-settings.component.html', // HTMLファイルを指定
  styleUrls: ['./user-settings.component.scss']   // CSSファイルを指定
})
export class UserSettingsComponent implements OnInit {
  displayNameForm!: FormGroup;
  passwordForm!: FormGroup;
  isLoadingDisplayName = false;
  isLoadingPassword = false;
  userEmail: string | null = null;

  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  ngOnInit(): void {
    this.displayNameForm = this.fb.group({
      displayName: ['', Validators.required]
    });

    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmNewPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.loadUserData();
  }

  async loadUserData() {
    try {
      const user = await this.authService.getCurrentUser();
      if (user) {
        if (user.displayName) {
          this.displayNameForm.patchValue({ displayName: user.displayName });
        }
        if (user.email) {
          this.userEmail = user.email;
        }
      } else {
        this.snackBar.open('ユーザー情報の取得に失敗しました。', '閉じる', { duration: 5000 });
      }
    } catch (error) {
      console.error('ユーザー情報の読み込みエラー:', error);
      this.snackBar.open('ユーザー情報の読み込み中にエラーが発生しました。', '閉じる', { duration: 5000 });
    }
  }

  async onDisplayNameSubmit() {
    if (this.displayNameForm.invalid || !this.displayNameForm.dirty) return;
    this.isLoadingDisplayName = true;
    const displayName = this.displayNameForm.value.displayName;
    const user = await this.authService.getCurrentUser();
    if (user) {
      try {
        await this.authService.updateUserProfile(user, { displayName });
        this.snackBar.open('表示名を変更しました', 'OK', { duration: 3000 });
        this.displayNameForm.markAsPristine();
      } catch (error) {
        console.error('表示名変更エラー:', error);
        this.snackBar.open('表示名の変更に失敗しました。', '閉じる', { duration: 5000 });
      }
    }
    this.isLoadingDisplayName = false;
  }

  async onPasswordSubmit() {
    if (this.passwordForm.invalid) return;
    this.isLoadingPassword = true;
    const { currentPassword, newPassword } = this.passwordForm.value;
    const user = await this.authService.getCurrentUser();
    if (user && user.email) {
      try {
        await this.authService.reauthenticateAndChangePassword(user, currentPassword, newPassword);
        this.snackBar.open('パスワードを変更しました', 'OK', { duration: 3000 });
        this.passwordForm.reset();
        Object.keys(this.passwordForm.controls).forEach(key => {
          this.passwordForm.get(key)?.setErrors(null) ;
        });
        this.passwordForm.setErrors(null);
      } catch (error: unknown) {
        console.error('パスワード変更エラー:', error);
        let errorMessage = 'パスワードの変更に失敗しました。';
        if (typeof error === 'object' && error !== null && 'code' in error) {
          const code = (error as { code: string }).code;
          if (code === 'auth/wrong-password') {
            errorMessage = '現在のパスワードが正しくありません。';
            this.passwordForm.get('currentPassword')?.setErrors({ incorrect: true });
          } else if (code === 'auth/too-many-requests') {
            errorMessage = '試行回数が多すぎます。後でもう一度お試しください。';
          }
        }
        this.snackBar.open(errorMessage, '閉じる', { duration: 5000 });
      }
    } else {
      this.snackBar.open('パスワード変更のためのユーザー情報が不十分です。', '閉じる', { duration: 5000 });
    }
    this.isLoadingPassword = false;
  }

  passwordMatchValidator(form: FormGroup): Record<string, boolean> | null {
    const newPassword = form.get('newPassword')?.value;
    const confirmNewPassword = form.get('confirmNewPassword')?.value;
    return newPassword && confirmNewPassword && newPassword === confirmNewPassword ? null : { mismatch: true };
  }
}