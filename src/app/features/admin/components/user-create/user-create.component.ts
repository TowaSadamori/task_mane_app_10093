import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators,ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { AdminUserService, CreateUserResponse } from '../../services/admin-user.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';


@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  templateUrl: './user-create.component.html',
  styleUrl: './user-create.component.scss'
})


export class UserCreateComponent implements OnInit {
  userCreateForm!: FormGroup;
  registrationError: string | null = null;
  isLoading = false;
  private adminUserService = inject(AdminUserService);
  private snackBar = inject(MatSnackBar);

  constructor() { }

  ngOnInit(): void {
    this.userCreateForm = new FormGroup({
      'email': new FormControl('', [Validators.required, Validators.email]),
      'password': new FormControl('', [Validators.required, Validators.minLength(8)]),
      'displayName': new FormControl(''),
      'role': new FormControl('', [Validators.required]),
    })
  }

  onSubmit(): void {
    if (this.userCreateForm.invalid) {
      this.userCreateForm.markAllAsTouched();
      console.error('Form is invalid');
      return;
    }

    this.isLoading = true;
    this.registrationError = null;

    const userData = this.userCreateForm.value;

    this.adminUserService.createUser(userData).subscribe({
      next: (response: CreateUserResponse) => {
        this.isLoading = false;
        console.log('ユーザー登録成功', response);
        alert(`ユーザー ${userData.email}を登録しました。(UID: ${response.uid})`);
        this.userCreateForm.reset();
      },
      error: (error: unknown) => {
        this.isLoading = false;
        console.error ('ユーザー登録失敗:', error);
        let errorMessage = 'ユーザー登録中にエラーが発生しました。';
        if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          }
          this.registrationError = errorMessage;
        
      }
    })
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
