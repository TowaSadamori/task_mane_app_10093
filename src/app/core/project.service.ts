import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  serverTimestamp,
  DocumentData,
  DocumentReference,
  CollectionReference,
  Timestamp,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  writeBatch,
//  FieldValue,
  // orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Task, TaskService, NewTaskData as CoreNewTaskData } from './task.service';


export interface Project {
  id: string;
  name: string;
  description: string;
  startDate?: Date | Timestamp | null;
  endDate?: Date | Timestamp | null;
  managerId: string;
  members?: string[];
  status?: 'active' | 'completed' | 'on-hold';
  createdAt: Date | Timestamp;
  managerIds?: string[]; // 複数管理者対応
}

export type NewProjectData = Omit<Project, 'id' | 'createdAt'>;



export type GanttTaskItem = Task;

export interface GanttTaskDisplayItem extends Omit<Task, 
  'plannedStartDate' | 
  'plannedEndDate' | 
  'actualStartDate' | 
  'actualEndDate' | 
  'createdAt' | 
  'updatedAt' |
  'dueDate' |
  'description'

> {
 
  plannedStartDate?: Date | null; 
  plannedEndDate?: Date | null;   
  actualStartDate?: Date | null;
  actualEndDate?: Date | null;
  createdAt?: Date;             
  updatedAt?: Date;
  dueDate?: Date | null;       
  name: string; 
  description?: string;
}


// Firestoreに保存する際のデータ型 (id は自動生成、日付は Date も許容)
export type NewGanttTaskData = Omit<GanttTaskItem, 'id' | 'createdAt' | 'updatedAt'> & {
  plannedStartDate: Date | Timestamp; // ← ここ
  plannedEndDate: Date | Timestamp;   // ← ここ
  actualStartDate?: Date | Timestamp | null;
  actualEndDate?: Date | Timestamp | null;
};


export type GanttTaskUpdatePayload = Partial<Omit<GanttTaskItem, 'id' | 'createdAt' | 'updatedAt'>> & {
  name?: string; // 明示的に更新可能なフィールドを列挙
  plannedStartDate?: Date | Timestamp;
  plannedEndDate?: Date | Timestamp;
  wbsNumber?: string;
  category?: string | null;
  primaryAssigneeId?: string | null;
  otherAssigneeIds?: string[] | null;
  decisionMakerId?: string | null;
  status?: string | null;
  actualStartDate?: Date | Timestamp | null;
  actualEndDate?: Date | Timestamp | null;
  progress?: number | null;
  level?: number | null;
  parentId?: string | null;
  updatedAt?: Date | Timestamp | import('@angular/fire/firestore').FieldValue;

};



@Injectable({
  providedIn: 'root'
})

export class ProjectService {
  private firestore: Firestore = inject(Firestore);
  private projectsCollection: CollectionReference<Project>;
  // private ganttTasksCollection: CollectionReference<GanttTaskItem>; // ← これは最終的に不要になる
  private taskService = inject(TaskService); // ★ TaskService をインジェクション


  constructor() { 
    this.projectsCollection = collection(this.firestore, 'Projects') as CollectionReference<Project>;
    // this.ganttTasksCollection = collection(this.firestore, 'Tasks') as CollectionReference<Task>; // ← TaskService経由にするので不要
  }

   getProjects(): Observable<Project[]> {
    return collectionData<Project>(this.projectsCollection, {idField: 'id'})
   }

   getProject(projectId: string): Observable<Project | undefined> {
    const projectDocRef = doc(this.firestore, 'Projects', projectId) as DocumentReference<Project>;
    return docData<Project>(projectDocRef, { idField: 'id' });
   }

   createProject(projectData: NewProjectData): Promise<DocumentReference<DocumentData>> {
    const projectsCollectionRefForAdd = collection(this.firestore, 'Projects');
    return addDoc(projectsCollectionRefForAdd, {
      ...projectData,
      createdAt: serverTimestamp(),
    });
   }

   updateProject(projectId: string, updateData: Partial<Project>): Promise<void> {
    const projectDocRef = doc(this.firestore, 'Projects', projectId);
    return updateDoc(projectDocRef, updateData);
   }

// project.service.ts
updateGanttTask(
  taskId: string,
  updateData: GanttTaskUpdatePayload // この型定義が Partial<Omit<Task, ...>> に近いことを確認
): Promise<void> {
  console.log(`ProjectService: updateGanttTask called for ID: ${taskId} with data:`, updateData);

  // GanttTaskUpdatePayload から Partial<Task> への変換/準備
  // updateData は既に Task ベースになっているはずなので、
  // TaskService の updateTask が受け付ける Partial<Task> と互換性があるか確認。
  // 特に日付型は Timestamp である必要がある。
  const dataToUpdateForCoreTask: Partial<Record<string, unknown>> = {}; 

  // updateData (GanttTaskUpdatePayload) から dataToUpdateForCoreTask (Partial<Task>) へ必要なプロパティをコピー＆型変換
  // (ここでのロジックは、GanttTaskUpdatePayload の定義と Task の定義に依存します)
  // 例えば、name があれば title にマッピングするなど。
  // 日付は Timestamp に変換する必要がある。

  // 以下は、updateData が既に Task のプロパティ名と型（日付は Date|Timestamp 許容）を持っている前提の簡易版
  for (const key in updateData) {
    if (Object.prototype.hasOwnProperty.call(updateData, key)) {
      const K = key as keyof GanttTaskUpdatePayload;
      if (K === 'name' && updateData.name !== undefined) { // name を title にマッピングする例
         dataToUpdateForCoreTask['title'] = updateData.name;
      } else if (K === 'plannedStartDate' || K === 'plannedEndDate' || K === 'actualStartDate' || K === 'actualEndDate' || K === 'dueDate') {
        const dateValue = updateData[K];
        if (dateValue instanceof Date) {
          dataToUpdateForCoreTask[K] = Timestamp.fromDate(dateValue);
        } else if (dateValue === null || dateValue instanceof Timestamp) {
          dataToUpdateForCoreTask[K] = dateValue;
        }
      } else {
        dataToUpdateForCoreTask[K] = updateData[K];
      }
    }
  }

  // updatedAt は TaskService 側で serverTimestamp() を使う想定なのでここでは不要かもしれないが、
  // もし ProjectService 側で明示的に更新したいなら追加
  if (Object.keys(dataToUpdateForCoreTask).length > 0) { // 何か更新するフィールドがあれば updatedAt をセット
       (dataToUpdateForCoreTask as Partial<Task>).updatedAt = serverTimestamp();
  }


  return this.taskService.updateTask(taskId, dataToUpdateForCoreTask);
}

   deleteProject(projectId: string): Promise<void> {
    const projectDocRef = doc(this.firestore, 'Projects', projectId);
    return deleteDoc(projectDocRef);
   }


   addGanttTask(taskData: NewGanttTaskData): Promise<DocumentReference<Task>> {
    console.log('ProjectService: addGanttTask called with data:', taskData);

    const dataToCreate: CoreNewTaskData = {
      ...taskData, // スプレッドで基本情報をコピー
      // 日付フィールドをTimestampに変換
      plannedStartDate: taskData.plannedStartDate instanceof Date
        ? Timestamp.fromDate(taskData.plannedStartDate)
        : taskData.plannedStartDate, // Timestampならそのまま
      plannedEndDate: taskData.plannedEndDate instanceof Date
        ? Timestamp.fromDate(taskData.plannedEndDate)
        : taskData.plannedEndDate,   // Timestampならそのまま
      dueDate: taskData.dueDate instanceof Date
        ? Timestamp.fromDate(taskData.dueDate)
        : taskData.dueDate,         // Timestampならそのまま、nullならnull
      // actualStartDate, actualEndDate も同様の変換が必要な場合がある
    };
    // createdAt, updatedAt は TaskService.createTask 内で serverTimestamp() で設定される

    return this.taskService.createTask(dataToCreate);
  }



  getGanttTasksForProject(projectId: string): Observable<GanttTaskDisplayItem[]> {
    return this.taskService.getTasksByProjectId(projectId).pipe(
      map(tasks => tasks.map(task => {
        // Task を GanttTaskDisplayItem にマッピングする処理
        // (このマッピングロジックは task.service.ts の convertTaskTimestampsToDate と同様のことができますが、
        //  GanttTaskDisplayItem の定義に合わせて調整が必要かもしれません)

        const plannedStartDate = task.plannedStartDate instanceof Timestamp ? task.plannedStartDate.toDate() : (task.plannedStartDate ?? null);
        const plannedEndDate = task.plannedEndDate instanceof Timestamp ? task.plannedEndDate.toDate() : (task.plannedEndDate ?? null);
        const actualStartDate = task.actualStartDate instanceof Timestamp ? task.actualStartDate.toDate() : (task.actualStartDate ?? null);
        const actualEndDate = task.actualEndDate instanceof Timestamp ? task.actualEndDate.toDate() : (task.actualEndDate ?? null);
        const createdAt = task.createdAt instanceof Timestamp ? task.createdAt.toDate() : undefined; // TaskDisplayに合わせるなら (task.createdAt as Date)
        const updatedAt = task.updatedAt instanceof Timestamp
          ? task.updatedAt.toDate()
          : (task.updatedAt instanceof Date ? task.updatedAt : undefined); // TaskDisplayに合わせる
        const dueDate = task.dueDate instanceof Timestamp ? task.dueDate.toDate() : (task.dueDate ?? null);

        return {
          // GanttTaskDisplayItem に必要なプロパティを task からマッピング
          id: task.id,
          title: task.title, // name プロパティとして GanttTaskDisplayItem には定義
          name: task.title,  // GanttTaskDisplayItem の 'name' プロパティに合わせる
          projectId: task.projectId,
          assigneeId: task.assigneeId,
          status: task.status, // 'todo' | 'doing' | 'done'
          blockerStatus: task.blockerStatus,
          progress: task.progress,
          level: task.level,
          parentId: task.parentId,
          wbsNumber: task.wbsNumber,
          category: task.category,
          otherAssigneeIds: task.otherAssigneeIds,
          decisionMakerId: task.decisionMakerId,

          // 日付フィールド (Date | null へ変換)
          plannedStartDate,
          plannedEndDate,
          actualStartDate,
          actualEndDate,
          createdAt, // createdAt は GanttTaskDisplayItem では Date 型
          updatedAt, // updatedAt は GanttTaskDisplayItem では Date | null 型
          dueDate,
        } as GanttTaskDisplayItem; // 型アサーション
      }))
    );
  }

// project.service.ts
async deleteGanttTaskRecursive(taskIdToDelete: string): Promise<void> {
  console.log(`ProjectService: Attempting to delete task: ${taskIdToDelete} (recursive deletion comportement to be handled by TaskService or as a separate logic if needed)`);

  // TaskService の deleteTask を呼び出して、Tasks コレクションから削除
  return this.taskService.deleteTask(taskIdToDelete)
    .then(() => {
      console.log(`ProjectService: Task ${taskIdToDelete} successfully requested for deletion via TaskService.`);
    })
    .catch(error => {
      console.error(`ProjectService: Error requesting deletion for task ${taskIdToDelete} via TaskService:`, error);
      throw error; // エラーを呼び出し元に伝える
    });
}

  // private async findAndDeleteChildrenRecursive(parentId: string, batch: ReturnType<typeof writeBatch>): Promise<void> {
  //   console.log(`  - Finding children of: ${parentId}`);
  //   const childrenQuery = query(this.ganttTasksCollection, where('parentId', '==', parentId));
    
  //   try {
  //     const childrenSnapshot = await getDocs(childrenQuery);
  //     if (childrenSnapshot.empty) {
  //       console.log(`    - No children found for ${parentId}`);
  //       return; // 子がいなければ終了
  //     }

  //     console.log(`    - Found ${childrenSnapshot.size} children for ${parentId}`);
  //     for (const childDoc of childrenSnapshot.docs) {
  //       const childId = childDoc.id;
  //       console.log(`      - Adding child to batch (delete): ${childId} (parent: ${parentId})`);
  //       batch.delete(childDoc.ref); // 子タスクをバッチに追加

  //       // さらに孫タスク以降も再帰的に検索して削除
  //       await this.findAndDeleteChildrenRecursive(childId, batch);
  //     }
  //   } catch (error) {
  //     console.error(`Error finding or deleting children for parent ${parentId}:`, error);
  //     // このエラーはバッチコミット前にキャッチされるべきだが、念のため
  //     throw error;
  //   }
  // }

  getGanttTasks(): Observable<GanttTaskDisplayItem[]> {
    return this.taskService.getTasks().pipe( // TaskServiceのgetTasksはTaskDisplay[]を返す
      map(taskDisplays => taskDisplays.map(td => {
        // TaskDisplay を GanttTaskDisplayItem に変換する必要があるか確認
        // GanttTaskDisplayItem と TaskDisplay のプロパティがほぼ同じであれば、
        // 単純なマッピングで済むか、あるいはTaskService.getTasks()の戻り値を直接使えるか検討
        return {
          ...td, // TaskDisplay のプロパティを展開
          name: td.title, // GanttTaskDisplayItem の name に合わせる
          // GanttTaskDisplayItem にあって TaskDisplay にないプロパティがあれば追加
          // (例: projectId, assigneeId など、TaskDisplay の Omit で除外されていなければtdに含まれる)
        } as GanttTaskDisplayItem;
      })));
  }

  /**
   * 指定されたプロジェクトIDのプロジェクトと、そのプロジェクトに関連するすべてのタスクを削除します。
   * @param projectId 削除するプロジェクトのID
   */
  async deleteProjectAndTasks(projectId: string): Promise<void> {
    if (!projectId) {
      throw new Error('プロジェクトIDが必要です。');
    }
    console.log(`ProjectService: プロジェクト (ID: ${projectId}) と関連タスクの削除を開始します。`);
    const batch = writeBatch(this.firestore);
    // 1. プロジェクトに関連するタスクを取得してバッチに削除処理を追加
    try {
      const tasksQuery = query(collection(this.firestore, 'Tasks'), where('projectId', '==', projectId));
      const tasksSnapshot = await getDocs(tasksQuery);
      if (!tasksSnapshot.empty) {
        console.log(`ProjectService: プロジェクト (ID: ${projectId}) に関連する ${tasksSnapshot.size} 件のタスクを削除対象とします。`);
        tasksSnapshot.forEach(taskDoc => {
          batch.delete(taskDoc.ref);
          console.log(`  - タスク (ID: ${taskDoc.id}) をバッチに追加しました。`);
        });
      } else {
        console.log(`ProjectService: プロジェクト (ID: ${projectId}) に関連するタスクは見つかりませんでした。`);
      }
    } catch (error) {
      console.error(`ProjectService: プロジェクト (ID: ${projectId}) の関連タスク取得中にエラー:`, error);
      throw new Error('関連タスクの取得に失敗しました。プロジェクト削除を中止します。');
    }
    // 2. プロジェクト本体をバッチに削除処理を追加
    const projectDocRef = doc(this.firestore, 'Projects', projectId);
    batch.delete(projectDocRef);
    console.log(`ProjectService: プロジェクト本体 (ID: ${projectId}) をバッチに追加しました。`);
    // 3. バッチ処理を実行
    try {
      await batch.commit();
      console.log(`ProjectService: プロジェクト (ID: ${projectId}) と関連タスクの削除バッチ処理が正常に完了しました。`);
    } catch (error) {
      console.error(`ProjectService: プロジェクト (ID: ${projectId}) と関連タスクの削除バッチ処理中にエラー:`, error);
      throw new Error('プロジェクトと関連タスクの削除処理に失敗しました。');
    }
  }
}
