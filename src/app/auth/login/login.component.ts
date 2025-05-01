import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
   templateUrl: './login.component.html',
   styleUrl: './login.component.scss',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
 
})

export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loginError: string | null = null;
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router
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


    } catch (error: any) {
      console.error('ログイン失敗:', error);

      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          this.loginError = 'メールアドレスまたはパスワードが正しくありません。';
          break;
        case 'auth/invalid-email':
          this.loginError = 'メールアドレスの形式が正しくありません。';
          break;
        case 'auth/too-many-requests':
          this.loginError = '試行回数が上限を超えました。しばらくしてから再度お試しください。';
          break;
        default:
          this.loginError = 'ログイン中にエラーが発生しました。時間をおいて再度お試しください。';
          break;
      }
      
    } finally {
      this.isLoading = false;
    }

  }

}

