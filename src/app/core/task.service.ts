import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
// import { AdminUserService } from '../features/admin/services/admin-user.service';
import { 
  Firestore, 
  collection, 
  collectionData, 
  DocumentData, 
  CollectionReference, doc, addDoc, 
  docData, serverTimestamp, updateDoc, 
  deleteDoc, DocumentReference, Timestamp, 
  query, orderBy, FieldValue } from '@angular/fire/firestore'; // FieldValue をインポート



export interface Task {
  id: string;                 // 既存: タスクID
  title: string;              // 既存: タスク名 (ガントチャートのタスク名としても使用)
  projectId: string;          // 既存: このタスクが属するプロジェクトのID
  assigneeId: string;         // 既存: 主担当者のID
  status: 'todo' | 'doing' | 'done'; // 既存: ToDoとしてのステータス (ガントチャートのステータスと連携させる想定)
  dueDate: Timestamp | null;    // ★ Date型からTimestamp型に変更
  createdAt: Timestamp;       // ★ Date型からTimestamp型に変更 (Firestore保存時は serverTimestamp())
  blockerStatus: string | null; 

  // --- ガントチャート用に追加するフィールド ---
  plannedStartDate?: Timestamp | null; // 予定開始日 (ガントチャート用)
  plannedEndDate?: Timestamp | null;   // 予定終了日 (ガントチャート用)
  actualStartDate?: Timestamp | null;  // 実績開始日 (日次ログ等から更新想定)
  actualEndDate?: Timestamp | null;    // 実績終了日 (日次ログ等から更新想定)
  progress?: number | null;            // 進捗率 (0-100, 日次ログ等から更新想定)
  level?: number;                      // WBS階層レベル (例: 0, 1, 2...)
  parentId?: string | null;            // 親タスクのID (同じTasksコレクション内の別のTaskのIDを指す)
  wbsNumber?: string;                  // WBS番号 (例: '1.1.2')
  category?: string | null;            // タスクカテゴリ (任意)
  otherAssigneeIds?: string[];   
  decisionMakerId?: string | null; 
  updatedAt?: Timestamp | FieldValue;
}

// 表示用
export interface TaskDisplay extends Omit<Task, 'dueDate' | 'createdAt' | 'plannedStartDate' | 'plannedEndDate' | 'actualStartDate' | 'actualEndDate' | 'updatedAt'> {
  dueDate: Date | null;
  createdAt: Date;
  plannedStartDate?: Date | null;
  plannedEndDate?: Date | null;
  actualStartDate?: Date | null;
  actualEndDate?: Date | null;
  updatedAt?: Date | null;
}

export interface PhotoEntry {
  id: string;
  url: string;
  fileName?: string;
  uploadedAt?: Timestamp;
  caption?: string | null;
  wasTakenByCamera?: boolean;
  processed?: string;
  processedAt?: Timestamp;
}

export type NewTaskData = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>; 

export interface DailyLog {
  id: string;
  workDate: Timestamp;
  reporterId: string;
  plannedStartTime?: Timestamp | null;
  plannedEndTime?: Timestamp | null;
  plannedBreakTime?: number | null;
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  actualBreakTime?: number | null;
  progressRate?: number | null;
  workerCount?: number | null;
  supervisor?: string | null;
  photos?: PhotoEntry[];
  comment?: string | null;
  createdAt: Timestamp;
  ganttTaskId?: string | null;
}

export type NewDailyLogData = Omit<DailyLog, 'id' | 'createdAt'>;

@Injectable({
  providedIn: 'root'
})

export class TaskService {

  private firestore: Firestore = inject(Firestore);
  private tasksCollection: CollectionReference<Task>;


  constructor() { 
    this.tasksCollection = collection(this.firestore, 'Tasks') as CollectionReference<Task>;
  }

  getTasks(): Observable<TaskDisplay[]> {
    return collectionData<Task>(this.tasksCollection, { idField: 'id' }).pipe(
      map(tasks => tasks.map(task => this.convertTaskTimestampsToDate(task)))
    );
  }

  getTask(taskId: string): Observable<TaskDisplay | undefined> {
    const taskDocRef = doc(this.firestore, 'Tasks', taskId) as DocumentReference<Task>;
    return docData<Task>(taskDocRef, { idField: 'id' }).pipe(
      map(task => task ? this.convertTaskTimestampsToDate(task) : undefined)
    );
  }

  // 共通変換関数を追加
  private convertTaskTimestampsToDate(task: Task): TaskDisplay {
    return {
      ...task,
      plannedStartDate: task.plannedStartDate instanceof Timestamp ? task.plannedStartDate.toDate() : task.plannedStartDate ?? null,
      plannedEndDate: task.plannedEndDate instanceof Timestamp ? task.plannedEndDate.toDate() : task.plannedEndDate ?? null,
      actualStartDate: task.actualStartDate instanceof Timestamp ? task.actualStartDate.toDate() : task.actualStartDate ?? null,
      actualEndDate: task.actualEndDate instanceof Timestamp ? task.actualEndDate.toDate() : task.actualEndDate ?? null,
      createdAt: task.createdAt instanceof Timestamp ? task.createdAt.toDate() : (task.createdAt as Date),
      updatedAt: task.updatedAt instanceof Timestamp
        ? task.updatedAt.toDate()
        : (task.updatedAt instanceof Date ? task.updatedAt : null),
      dueDate: task.dueDate instanceof Timestamp ? task.dueDate.toDate() : task.dueDate ?? null,
    };
  }

  createTask(taskData: NewTaskData): Promise<DocumentReference<Task>> {
    return addDoc(this.tasksCollection, {
      id: '', // Firestoreが自動で上書きするので空文字でOK
      ...taskData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } as Task);
  }

  updateTask(taskId: string, updatedData: Partial<Task>): Promise<void> {
    const taskDocRef = doc(this.firestore, 'Tasks', taskId);
    return updateDoc(taskDocRef, updatedData);
  }

  deleteTask(taskId: string): Promise<void> {
    const taskDocRef = doc(this.firestore, 'Tasks', taskId);
    return deleteDoc(taskDocRef);
  }

  getDailyLogs(taskId: string): Observable<DailyLog[]> {
    const taskDocRef = doc(this.firestore, 'Tasks', taskId) as DocumentReference<Task>;
    const dailyLogsCollectionRef = collection(taskDocRef, 'DailyLogs') as CollectionReference<DailyLog>;
    const q = query(dailyLogsCollectionRef, orderBy('workDate', 'asc'));
    return collectionData<DailyLog>(q, { idField: 'id' });
  }

  addDailyLog(taskId: string, dailyLogData: NewDailyLogData): Promise<DocumentReference<DocumentData>> {
    const taskDocRef = doc(this.firestore, 'Tasks', taskId);
    const dailyLogsCollectionRef = collection(taskDocRef, 'DailyLogs');
    return addDoc(dailyLogsCollectionRef, {
      ...dailyLogData,
      createdAt: serverTimestamp()
    });
  }

  updateDailyLog(taskId: string, logId: string, updatedData:Partial<DailyLog>):Promise<void> {
    const dailyLogDocRef = doc(this.firestore, 'Tasks', taskId, 'DailyLogs', logId);
    return updateDoc(dailyLogDocRef, updatedData);
  }

  updateTaskBlockerStatus(taskId: string, newStatus: string | null ): Promise<void> {
    if (!taskId) {
      console.error('Task ID is required to update blocker status');
      return Promise.reject(new Error('Task ID is required.'));
    }
    const taskDocRef = doc(this.firestore, `Tasks/${taskId}`);
    return updateDoc(taskDocRef, {
      blockerStatus: newStatus,
      updatedAt: serverTimestamp(),
    });
  }

  updateTaskProgress(taskId: string, progress: number): Promise<void> {
    if (progress < 0 || progress > 100) {
      // エラーハンドリング: 不正な進捗率の場合はエラーを返す
      console.error('不正な進捗率が指定されました:', progress);
      return Promise.reject(new Error('進捗率は0から100の間で指定してください。'));
    }
    const taskDocRef = doc(this.firestore, `Tasks/${taskId}`);
    return updateDoc(taskDocRef, {
      progress: progress,
      updatedAt: serverTimestamp() // 最終更新日時も更新
    });
  }


  updateTaskProgressAndStatus(taskId: string, progress: number, status: 'todo' | 'doing' | 'done'): Promise<void> {
    if (progress < 0 || progress > 100) {
      console.error('不正な進捗率が指定されました:', progress);
      return Promise.reject(new Error('進捗率は0から100の間で指定してください。'));
    }
    const validStatuses: ('todo' | 'doing' | 'done')[] = ['todo', 'doing', 'done'];
    if (!validStatuses.includes(status)) {
      console.error('不正なステータスが指定されました:', status);
      return Promise.reject(new Error('ステータスは "todo", "doing", "done" のいずれかである必要があります。'));
    }

    const taskDocRef = doc(this.firestore, `Tasks/${taskId}`);
    return updateDoc(taskDocRef, {
      progress: progress,
      status: status,
      updatedAt: serverTimestamp()
    });
  }

}
