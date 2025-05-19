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

  // constructor() { }

  ngOnInit(): void {
    this.userCreateForm = new FormGroup({
      'email': new FormControl('', [Validators.required, Validators.email]),
      'password': new FormControl('', [Validators.required, Validators.minLength(8)]),
      'displayName': new FormControl(''),
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
