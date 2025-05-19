import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallableData } from '@angular/fire/functions';
import { Observable } from 'rxjs';

interface CreateUserData {
  email: string;
  password: string;
  displayName: string;
}

export interface CreateUserResponse {
  success: boolean;
  uid?: string;
  message?: string;
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
}
