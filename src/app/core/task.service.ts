import { Injectable, inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
// import { AdminUserService } from '../features/admin/services/admin-user.service';
import { 
  Firestore, 
  collection, 
  collectionData, 
  DocumentData, 
  CollectionReference, doc, addDoc, 
  docData, serverTimestamp, updateDoc, 
  deleteDoc, DocumentReference, Timestamp,
  getDocs, query, orderBy, FieldValue, where } from '@angular/fire/firestore'; // FieldValue をインポート
  // task.service.ts の先頭の方
import { GanttChartTask } from './models/gantt-chart-task.model';






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
  memo?: string | null;
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

// task.service.ts
// ... (Task インターフェースの定義はそのまま) ...

export type NewTaskData = Omit<Task,
  'id' | 'createdAt' | 'updatedAt' | 'plannedStartDate' | 'plannedEndDate' | 'dueDate'
> & {
  title: string;
  description?: string;
  projectId: string;
  assigneeId: string;
  status: 'todo' | 'doing' | 'done';
  dueDate: Date | Timestamp | null; // ← 型を上書き
  plannedStartDate: Date | Timestamp;
  plannedEndDate: Date | Timestamp;
  blockerStatus?: string | null;
  actualStartDate?: Date | Timestamp | null;
  actualEndDate?: Date | Timestamp | null;
  progress?: number | null;
  level?: number;
  parentId?: string | null;
  wbsNumber?: string;
  category?: string | null;
  otherAssigneeIds?: string[];
  decisionMakerId?: string | null;
};



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

  // TaskService クラス内に追加
  async addGanttChartTask(taskData: Omit<GanttChartTask, 'id' | 'createdAt'>): Promise<DocumentReference> {
    console.log('[TaskService] addGanttChartTask 実行。データ:', taskData);
    try {
      const ganttTasksCollectionRef = collection(this.firestore, 'GanttChartTasks'); // ★コレクション名を確認！
      const docRef = await addDoc(ganttTasksCollectionRef, {
        ...taskData,
        createdAt: serverTimestamp()
      });
      console.log('[TaskService] Firestore保存成功。ID:', docRef.id);
      return docRef;
    } catch (error) {
      console.error('[TaskService] Firestore保存エラー(詳細):', error);
      if (error instanceof Error) {
        console.error('[TaskService] エラー名:', error.name);
        console.error('[TaskService] エラーメッセージ:', error.message);
        if ('code' in error) {
          console.error('[TaskService] Firebaseエラーコード:', (error as Record<string, unknown>)['code']);
        }
      }
      throw error;
    }
  }

// TaskService クラス内に追加 (addGanttChartTask メソッドの近くなど)
getGanttChartTasksByProjectId(projectId: string): Observable<GanttChartTask[]> {
  console.log(`[TaskService] getGanttChartTasksByProjectId - STEP 1: Called for projectId: ${projectId}`);
  const newTasksCollectionRef = collection(this.firestore, 'GanttChartTasks'); // ★新しいコレクション名
  const q = query(
    newTasksCollectionRef,
    where('projectId', '==', projectId),
    orderBy('createdAt', 'asc') // createdAtで並び替え（もしcreatedAtを保存する場合）
                                  // もしcreatedAtを保存しないなら、orderByなしでもOK
  );
  console.log(`[TaskService] getGanttChartTasksByProjectId - STEP 2: Query created for projectId: ${projectId}`);

  return from(getDocs(q)).pipe( // from() で Promise を Observable に変換
    map(querySnapshot => {
      const tasks: GanttChartTask[] = [];
      querySnapshot.forEach(doc => {
        tasks.push({ id: doc.id, ...doc.data() } as GanttChartTask);
      });
      console.log(`[TaskService] getGanttChartTasksByProjectId - STEP 3 (map): Fetched ${tasks.length} tasks for projectId ${projectId}. Tasks:`, tasks);
      return tasks;
    }),
    catchError(error => {
      console.error(`[TaskService] getGanttChartTasksByProjectId - ERROR fetching tasks for projectId ${projectId}:`, error);
      return of([]); // エラー時は空の配列を返す Observable を返す
    })
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

  // TaskService の createTask メソッド内
createTask(taskData: NewTaskData): Promise<DocumentReference<Task>> {
  const dataToSave = {
    ...taskData,
    // plannedStartDate を Timestamp に変換
    plannedStartDate: taskData.plannedStartDate instanceof Date
      ? Timestamp.fromDate(taskData.plannedStartDate)
      : taskData.plannedStartDate, // Timestamp ならそのまま
    // plannedEndDate を Timestamp に変換
    plannedEndDate: taskData.plannedEndDate instanceof Date
      ? Timestamp.fromDate(taskData.plannedEndDate)
      : taskData.plannedEndDate, // Timestamp ならそのまま
    // dueDate も同様の変換が必要な場合
    dueDate: taskData.dueDate instanceof Date
      ? Timestamp.fromDate(taskData.dueDate)
      : taskData.dueDate, // Timestamp または null ならそのまま
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  return addDoc(this.tasksCollection, dataToSave as Task); // Firestoreに保存する際はTask型に合わせる
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

  getTasksByProjectId(projectId: string): Observable<Task[]> {
    const tasksQuery = query(
      this.tasksCollection,
      where('projectId', '==', projectId),
      orderBy('createdAt', 'asc')
    );
    return collectionData<Task>(tasksQuery, { idField: 'id' });
  }

  // TaskService クラス内の適切な場所に追加
  // ▼▼▼ ガントチャート専用のタスク更新メソッド ▼▼▼
  async updateGanttChartTask(taskId: string, taskData: Partial<GanttChartTask>): Promise<void> {
    console.log(`[TaskService-Simple] updateGanttChartTask called for ID: ${taskId} with data:`, taskData);
    if (!taskId) {
      console.error('[TaskService-Simple] Task ID is required for update.');
      throw new Error('Task ID is required for update.');
    }
    try {
      const taskDocRef = doc(this.firestore, 'GanttChartTasks', taskId); // ★コレクション名を確認
      const title = taskData.title ?? null;
      await updateDoc(taskDocRef, {
        ...taskData,
        title,
        updatedAt: serverTimestamp() // 更新日時を自動設定
      });
      console.log(`[TaskService-Simple] GanttChartTask with ID: ${taskId} updated successfully.`);
    } catch (error) {
      console.error(`[TaskService-Simple] Error updating GanttChartTask with ID: ${taskId}:`, error);
      if (error instanceof Error) {
        console.error('[TaskService-Simple] Error name:', error.name);
        console.error('[TaskService-Simple] Error message:', error.message);
        if ('code' in error) {
          console.error('[TaskService-Simple] Firebase Error Code:', (error as Record<string, unknown>)['code']);
        }
      }
      throw error;
    }
  }

  // ▼▼▼ ガントチャート専用のタスク削除メソッド ▼▼▼
  async deleteGanttChartTask(taskId: string): Promise<void> {
    console.log(`[TaskService-Simple] deleteGanttChartTask called for ID: ${taskId}`);
    if (!taskId) {
      console.error('[TaskService-Simple] Task ID is required for deletion.');
      throw new Error('Task ID is required for deletion.');
    }
    try {
      const taskDocRef = doc(this.firestore, 'GanttChartTasks', taskId);
      await deleteDoc(taskDocRef);
      console.log(`[TaskService-Simple] GanttChartTask with ID: ${taskId} deleted successfully.`);
    } catch (error) {
      console.error(`[TaskService-Simple] Error deleting GanttChartTask with ID: ${taskId}:`, error);
      if (error instanceof Error) {
        console.error('[TaskService-Simple] Error name:', error.name);
        console.error('[TaskService-Simple] Error message:', error.message);
        if ('code' in error) {
          console.error('[TaskService-Simple] Firebase Error Code:', (error as Record<string, unknown>)['code']);
        }
      }
      throw error;
    }
  }

}
