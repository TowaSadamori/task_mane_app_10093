import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  signInWithEmailAndPassword,
  signOut,
  User,
  UserCredential,
  updateEmail,
  updatePassword,
  updateProfile,
  EmailAuthProvider, // ★ EmailAuthProvider をインポート
  reauthenticateWithCredential // ★ reauthenticateWithCredential をインポート
  // reauthenticateWithCredential, // 必要に応じて使用
  // EmailAuthProvider // 必要に応じて使用
} from '@angular/fire/auth';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  public readonly authState$: Observable<User | null> = authState(this.auth);

  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  login(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  logout(): Promise<void> {
    return signOut(this.auth);
  }

  async updateUserEmail(newEmail: string): Promise<void> {
    const user = this.getCurrentUser();
    if (user) {
      return updateEmail(user, newEmail);
    }
    return Promise.reject(new Error('User not logged in.'));
  }

  async updateUserPassword(newPassword: string): Promise<void> {
    const user = this.getCurrentUser();
    if (user) {
      return updatePassword(user, newPassword);
    }
    return Promise.reject(new Error('User not logged in.'));
  }

  async updateUserProfile(profileData: { displayName?: string | null; photoURL?: string | null }): Promise<void> {
    const user = this.getCurrentUser();
    if (user) {
      return updateProfile(user, profileData);
    }
    return Promise.reject(new Error('User not logged in.'));
  }

  async reauthenticateUser(currentPassword: string): Promise<void> {
    const user = this.getCurrentUser();
    if (user && user.email) { // ユーザーが存在し、メールアドレスがあることを確認
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
    }
    return Promise.reject(new Error('User not logged in or email not available for re-authentication.'));
  }


}