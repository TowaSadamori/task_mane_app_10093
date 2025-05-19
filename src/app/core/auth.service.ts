import { Injectable, inject } from '@angular/core';
import {
   Auth,
   authState,
   signInWithEmailAndPassword,
   signOut,
   User,
   UserCredential,
   createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
   updateProfile
  } from '@angular/fire/auth';
import { Observable } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private auth: Auth = inject(Auth);

  public readonly authState$: Observable<User | null> = authState(this.auth);

  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  createUserWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    return firebaseCreateUserWithEmailAndPassword(this.auth, email, password);
  }

  updateUserProfile(user: User, profileData: { displayName?: string | null, photoURL?: string | null }): Promise<void> {
    return updateProfile(user, profileData);
  }
}

