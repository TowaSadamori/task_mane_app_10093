import { Timestamp } from '@angular/fire/firestore';

export interface User {
  id: string;                 // FirestoreドキュメントID
  displayName: string;        // 表示名 (Firestoreの 'displayName' フィールドに対応)
  email: string;              // メールアドレス (Firestoreの 'email' フィールドに対応)
  role: string;               // 役割 (Firestoreの 'role' フィールドに対応)
  createdAt?: Timestamp;       // 作成日時 (Firestoreの 'createdAt' フィールドに対応、オプショナル)
  // --- カタログにある他のオプショナルなユーザー情報フィールドの例 ---
  // phoneNumber?: string;
  // birthDate?: Timestamp | null;
  // bloodType?: string;
  // age?: number;
  // qualifications?: string[];
  // emergencyContact?: string;
}