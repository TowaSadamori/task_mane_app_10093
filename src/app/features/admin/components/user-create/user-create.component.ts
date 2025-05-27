import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp, collection, query, where, getDocs } from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-create.component.html',
  styleUrls: ['./user-create.component.scss']
})
export class UserCreateComponent {
  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    displayName: new FormControl('', [Validators.required])
  });
  loading = false;
  error: string | null = null;
  success = false;

  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private router: Router
  ) {}

  async onSubmit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = null;
    this.success = false;
    const { email, password, displayName } = this.form.value as { email: string; password: string; displayName: string };

    // 1. 表示名の重複チェック
    const usersRef = collection(this.firestore, 'Users');
    const q = query(usersRef, where('displayName', '==', displayName));
    const snap = await getDocs(q);
    if (!snap.empty) {
      this.error = 'この表示名は既に使用されています。';
      this.loading = false;
      return;
    }

    try {
      // 1. Firebase Authでユーザー作成
      const cred = await createUserWithEmailAndPassword(this.auth, email, password);
      // 2. 表示名を設定
      await updateProfile(cred.user, { displayName });
      // 3. Firestoreにユーザー情報を保存
      await setDoc(doc(this.firestore, 'Users', cred.user.uid), {
        uid: cred.user.uid,
        email,
        displayName,
        createdAt: serverTimestamp()
      });
      this.success = true;
      this.form.reset();
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === 'auth/email-already-in-use') {
        this.error = 'このメールアドレスは既に使用されています。';
      } else if (error.code === 'auth/invalid-email') {
        this.error = '無効なメールアドレスです。';
      } else if (error.code === 'auth/weak-password') {
        this.error = 'パスワードは6文字以上で入力してください。';
      } else {
        this.error = '登録中にエラーが発生しました。';
      }
    } finally {
      this.loading = false;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
