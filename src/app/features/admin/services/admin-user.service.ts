import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallableData } from '@angular/fire/functions';
import { Observable, of } from 'rxjs';

interface CreateUserData {
  email: string;
  password: string;
  displayName: string;
  // role: string;
}

export interface CreateUserResponse {
  success: boolean;
  uid?: string;
  message?: string;
}

export interface User {
  email: string;
  displayName: string;
  password?: string;
  // 必要に応じて他のプロパティも追加
}

@Injectable({
  providedIn: 'root'
})
export class AdminUserService {
  private functions : Functions = inject(Functions);

  // constructor() {}

  createUser(userData: CreateUserData): Observable<CreateUserResponse> {
    const createUserFn = httpsCallableData<CreateUserData,CreateUserResponse>(this.functions, 'createUser');

    return createUserFn(userData);
  }

  updateUser(): Observable<{ success: boolean }> {
    return of({ success: true });
  }
}
