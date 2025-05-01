import { Injectable, inject } from '@angular/core';
import {
   Auth,
   authState,
   signInWithEmailAndPassword,
   signOut,
   User,
   UserCredential,
  } from '@angular/fire/auth';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private auth: Auth = inject(Auth);

  public readonly authState$: Observable<User | null> = authState(this.auth);

  constructor() { }

  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }
  }

