import { Injectable, inject } from '@angular/core';
import {
   Auth,
   authState,
   signInWithEmailAndPassword,
   signOut,
   User,
   UserCredential,
   createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
   updateProfile,
   onAuthStateChanged,
   getAuth,
   updatePassword,
   EmailAuthProvider,
   reauthenticateWithCredential
  } from '@angular/fire/auth';
import { Observable } from 'rxjs';
import { doc, updateDoc } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';


@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);

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

  async updateUserProfile(user: User, profileData: { displayName?: string | null, photoURL?: string | null }): Promise<void> {
    // 1. Firebase Authのプロフィールを更新
    await updateProfile(user, profileData);
    // 2. FirestoreのUsersコレクションも更新
    if (profileData.displayName) {
      const userDocRef = doc(this.firestore, 'Users', user.uid);
      await updateDoc(userDocRef, { displayName: profileData.displayName });
    }
  }

  getCurrentUser(): Promise<User | null> {
    const auth = getAuth();
    return new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(auth, user => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  async reauthenticateAndChangePassword(user: User, currentPassword: string, newPassword: string): Promise<void> {
    if (!user.email) throw new Error('メールアドレスが取得できません');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  }
}

