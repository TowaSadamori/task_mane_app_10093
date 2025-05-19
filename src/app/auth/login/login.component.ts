import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { Router, RouterModule } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
// import { doc, setDoc, serverTimestamp, Timestamp } from '@angular/fire/firestore';

@Component({
  selector: 'app-login',
  standalone: true,
   templateUrl: './login.component.html',
   styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    RouterModule,
  ],
 
})

export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loginError: string | null = null;
  isLoading = false;
  registrationError: string | null = null;
  registrationSuccess = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.loginForm = new FormGroup({
    'email': new FormControl('',
      [Validators.required,
        Validators.email,
      ]),
    'password': new FormControl('',
      [Validators.required
      ]),
    });
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    
    this.isLoading = true;
    this.loginError = null;

    try {
      const email = this.loginForm.value.email;
      const password = this.loginForm.value.password;

      const userCredential = await this.authService.login(email, password);

      console.log('ログイン成功:', userCredential.user);

      this.router.navigate(['/app/dashboard']);

    } catch (error: unknown) {
      console.error('ログイン失敗:', error);
      const code = (typeof error === 'object' && error !== null && 'code' in error) ? (error as { code?: string }).code : undefined;
      this.loginError = this.mapAuthError(code);
      this.snackBar.open(this.loginError, '閉じる', { duration: 7000, panelClass: ['error-snackbar'] });
    } finally {
      this.isLoading = false;
    }
  }

  private mapAuthError(code: string | undefined): string {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'メールアドレスまたはパスワードが正しくありません。';
      case 'auth/invalid-email':
        return 'メールアドレスの形式が正しくありません。';
      case 'auth/too-many-requests':
        return '試行回数が上限を超えました。しばらくしてから再度お試しください。';
      default:
        return 'ログイン中にエラーが発生しました。時間をおいて再度お試しください。';
    }
  }
}

