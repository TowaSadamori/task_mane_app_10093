import { Injectable, inject } from '@angular/core';
import { Firestore, collection, collectionData, CollectionReference, query, orderBy,
         doc, getDoc, DocumentReference } from '@angular/fire/firestore'; // documentId, where を削除 (inクエリ版を使わないため)
import { Observable, of, forkJoin, from } from 'rxjs'; // combineLatest を削除
import { map, tap } from 'rxjs/operators'; // mergeMap, toArray を削除
import { User } from './models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestore: Firestore = inject(Firestore);
  private usersCollection: CollectionReference<User>;

  constructor() {
    // ★ 'Users' は実際のコレクション名に置き換えてください (今回は 'Users' で合っているはずです)
    this.usersCollection = collection(this.firestore, 'Users') as CollectionReference<User>;
  }

  getUsers(): Observable<User[]> {
    // displayNameで並び替えるクエリを作成
    const usersQuery = query(this.usersCollection, orderBy('displayName')); // ★ エラーが出ていた orderBy
    return collectionData<User>(usersQuery, { idField: 'id' });
  }

  /**
   * 指定されたユーザーIDの配列に一致するユーザーのリストを取得します。
   * @param userIds 取得したいユーザーのID配列
   * @returns User[] の Observable
   */
  getUsersByIds(userIds: string[]): Observable<User[]> {
    console.log('[UserService DEBUG] getUsersByIds (individual fetch) called with userIds:', userIds);
    if (!userIds || userIds.length === 0) {
      console.log('[UserService DEBUG] userIds is empty, returning [].');
      return of([]);
    }

    // 各IDに対して個別にドキュメントを取得するObservableの配列を作成
    const userDocObservables: Observable<User | null>[] = userIds.map(id => { // Observable<User | null>[] に型変更
      const userDocRef = doc(this.firestore, `Users/${id}`) as DocumentReference<User>;
      console.log(`[UserService DEBUG] Attempting to get doc for ID: Users/${id}`);
      return from(getDoc(userDocRef)).pipe(
        map(docSnap => {
          if (docSnap.exists()) {
            console.log(`[UserService DEBUG] Document found for ID: ${id}`, docSnap.data());
            // docSnap.data() の中に id プロパティが含まれていないことを期待
            // id は docSnap.id から取得するのが確実
            const userData = docSnap.data();
            return {
              id: docSnap.id,
              displayName: userData.displayName, // Userインターフェースに合わせて明示的にマッピング
              email: userData.email,
              role: userData.role,
              createdAt: userData.createdAt,
              // 他のUserインターフェースのプロパティも同様にマッピング
            } as User;
          } else {
            console.warn(`[UserService DEBUG] No document found for ID: ${id}`);
            return null;
          }
        })
      );
    });

    // すべてのドキュメント取得Observableが完了したら結果を結合
    return forkJoin(userDocObservables).pipe(
      map(usersWithNulls => usersWithNulls.filter(user => user !== null) as User[]), // nullを除去
      tap(finalUsers => console.log('[UserService DEBUG] Final users from individual fetch:', finalUsers))
    );
  }
}