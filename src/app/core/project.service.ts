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
  // query,
  // where,
  // getDocs,
  // writeBatch,
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
}

type NewProjectData = Omit<Project, 'id' | 'createdAt'>;



export type GanttTaskItem = Task;

export interface GanttTaskDisplayItem extends Omit<Task, 
  'plannedStartDate' | 
  'plannedEndDate' | 
  'actualStartDate' | 
  'actualEndDate' | 
  'createdAt' | 
  'updatedAt' |
  'dueDate' 

> {
 
  plannedStartDate?: Date | null; 
  plannedEndDate?: Date | null;   
  actualStartDate?: Date | null;
  actualEndDate?: Date | null;
  createdAt?: Date;             
  updatedAt?: Date;
  dueDate?: Date | null;       

  name: string; 
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



  getGanttTasks(): Observable<GanttTaskDisplayItem[]> {
    return this.taskService.getTasks().pipe(
      map(tasks => tasks.map(task => {
        // すべてのTimestampをDateに変換
        const plannedStartDate = task.plannedStartDate instanceof Timestamp ? task.plannedStartDate.toDate() : (task.plannedStartDate ?? null);
        const plannedEndDate = task.plannedEndDate instanceof Timestamp ? task.plannedEndDate.toDate() : (task.plannedEndDate ?? null);
        const actualStartDate = task.actualStartDate instanceof Timestamp ? task.actualStartDate.toDate() : (task.actualStartDate ?? null);
        const actualEndDate = task.actualEndDate instanceof Timestamp ? task.actualEndDate.toDate() : (task.actualEndDate ?? null);
        const createdAt = task.createdAt instanceof Timestamp ? task.createdAt.toDate() : undefined;
        const updatedAt = task.updatedAt instanceof Timestamp ? task.updatedAt.toDate() : undefined;
        const dueDate = task.dueDate instanceof Timestamp ? task.dueDate.toDate() : (task.dueDate ?? null);

        return {
          ...task,
          name: task.title,
          plannedStartDate,
          plannedEndDate,
          actualStartDate,
          actualEndDate,
          createdAt,
          updatedAt,
          dueDate,
        };
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

  
}
