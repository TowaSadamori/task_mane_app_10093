import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  CollectionReference,
  query,
  orderBy,
  doc,
  getDoc,
  DocumentReference,
  updateDoc,
  // docData,
} from '@angular/fire/firestore';
import { Observable, of, forkJoin, from, throwError } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { User } from './models/user.model'; // この User モデルの定義を確認したい

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestore: Firestore = inject(Firestore);
  private usersCollectionRef: CollectionReference<User>;
  async updateUser(userId: string, data: Partial<User>): Promise<void> {
    if (!userId) {
      return Promise.reject(new Error('User ID is required for update.'));
    }
    const userDocRef = doc(this.firestore, `Users/${userId}`);
    return updateDoc(userDocRef, data); // ★ updateDoc がここで使用されている
  }

  constructor() {
    this.usersCollectionRef = collection(this.firestore, 'Users') as CollectionReference<User>;
  }

  getUsers(): Observable<User[]> {
    const usersQuery = query(this.usersCollectionRef, orderBy('displayName'));
    return collectionData<User>(usersQuery, { idField: 'id' });
  }

  getUsersByIds(userIds: string[]): Observable<User[]> {
    console.log('[UserService DEBUG] getUsersByIds (individual fetch) called with userIds:', userIds);
    if (!userIds || userIds.length === 0) {
      console.log('[UserService DEBUG] userIds is empty, returning [].');
      return of([]);
    }
    const userDocObservables: Observable<User | null>[] = userIds.map(id => {
      const userDocRef = doc(this.firestore, `Users/${id}`) as DocumentReference<User>;
      console.log(`[UserService DEBUG] Attempting to get doc for ID: Users/${id}`);
      return from(getDoc(userDocRef)).pipe(
        map(docSnap => {
          if (docSnap.exists()) {
            console.log(`[UserService DEBUG] Document found for ID: ${id}`, docSnap.data());
            const userData = docSnap.data();
            return {
              id: docSnap.id,
              displayName: userData.displayName,
              email: userData.email,
              role: userData.role,
              createdAt: userData.createdAt,
            } as User;
          } else {
            console.warn(`[UserService DEBUG] No document found for ID: ${id}`);
            return null;
          }
        })
      );
    });
    return forkJoin(userDocObservables).pipe(
      map(usersWithNulls => usersWithNulls.filter(user => user !== null) as User[]),
      tap(finalUsers => console.log('[UserService DEBUG] Final users from individual fetch:', finalUsers))
    );
  }

  getUser(userId: string): Observable<User | null> {
    console.log(`[UserService.getUser using getDoc] Called with userId: "${userId}"`);
    if (!userId) {
      console.warn('[UserService.getUser using getDoc] userId is undefined or null. Returning of(null).');
      return of(null);
    }

    try {
      const path = `Users/${userId}`;
      console.log(`[UserService.getUser using getDoc] Attempting to get document reference for path: "${path}"`);
      const userDocRef = doc(this.firestore, path) as DocumentReference<User>; // DocumentReference<User> にキャスト
      console.log(`[UserService.getUser using getDoc] DocumentReference created:`, userDocRef);

      if (!userDocRef || typeof userDocRef.path !== 'string') {
        console.error('[UserService.getUser using getDoc] CRITICAL: userDocRef does not appear to be a valid DocumentReference!', userDocRef);
        return throwError(() => new Error('Failed to create a valid DocumentReference in UserService.getUser.'));
      }

      console.log(`[UserService.getUser using getDoc] Attempting to getDoc for DocumentReference path: "${userDocRef.path}".`);
      return from(getDoc(userDocRef)).pipe(
        map(docSnap => {
          if (docSnap.exists()) {
            const documentData = docSnap.data(); // これは DocumentData 型 (または User 型だが id を含まない想定)
            console.log(`[UserService.getUser using getDoc] Document data for path "${path}":`, documentData);
            
            // User モデルのプロパティを明示的にマッピング
            const userObject: User = {
              id: docSnap.id, // ドキュメントIDをセット
              displayName: documentData['displayName'] || '', // displayName を取得
              email: documentData['email'] || '',           // email を取得
              role: documentData['role'] || '',             // role を取得
              createdAt: documentData['createdAt']          // createdAt を取得 (オプショナルなので undefined も許容)
              // User モデルで定義されている他の必須・オプショナルプロパティも同様に追加
            };
            return userObject;
          } else {
            console.log(`[UserService.getUser using getDoc] No document found for path "${path}".`);
            return null;
          }
        }),
        catchError((e: unknown) => {
          console.error(`[UserService.getUser using getDoc] Synchronous error for path "Users/${userId}":`, e);
          const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred in UserService.getUser (synchronous part with getDoc).';
          return throwError(() => new Error(errorMessage));
        })
      );
    } catch (e) {
      console.error(`[UserService.getUser using getDoc] Asynchronous error for path "Users/${userId}":`, e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred in UserService.getUser (asynchronous part with getDoc).';
      return throwError(() => new Error(errorMessage));
    }
  }
}