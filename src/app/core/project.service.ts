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
  // orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';


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

// project.service.ts の適切な箇所に (GanttTaskDisplayItem の前など)
export interface GanttTaskItem {
  id: string; // FirestoreのドキュメントID
  name: string;
  plannedStartDate: Timestamp; // FirestoreではTimestamp型で保存
  plannedEndDate: Timestamp;   // FirestoreではTimestamp型で保存
  wbsNumber?: string;
  category?: string;
  primaryAssigneeId?:  string | null,
  decisionMakerId?:  string | null,
  otherAssigneeIds?: string[];
  status?: string; // 例: '未着手', '作業中', '完了'
  actualStartDate?: Timestamp | null;
  actualEndDate?: Timestamp | null;
  progress?: number;
  level?: number;
  parentId?: string | null;
  createdAt?: Timestamp; // Firestoreのサーバータイムスタンプ
  updatedAt?: Timestamp; // Firestoreのサーバータイムスタンプ
}

export interface GanttTaskDisplayItem extends Omit<GanttTaskItem, 'plannedStartDate' | 'plannedEndDate' | 'actualStartDate' | 'actualEndDate' | 'createdAt' | 'updatedAt'> {
  plannedStartDate: Date;
  plannedEndDate: Date;
  actualStartDate?: Date | null;
  actualEndDate?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Firestoreに保存する際のデータ型 (id は自動生成、日付は Date も許容)
export type NewGanttTaskData = Omit<GanttTaskItem, 'id' | 'createdAt' | 'updatedAt'> & {
  plannedStartDate: Date | Timestamp;
  plannedEndDate: Date | Timestamp;
  actualStartDate?: Date | Timestamp | null;
  actualEndDate?: Date | Timestamp | null;
};

@Injectable({
  providedIn: 'root'
})

export class ProjectService {
  private firestore: Firestore = inject(Firestore);
  private projectsCollection: CollectionReference<Project>;
  private ganttTasksCollection: CollectionReference<GanttTaskItem>;

  constructor() { 
    this.projectsCollection = collection(this.firestore, 'Projects') as CollectionReference<Project>;
    this.ganttTasksCollection = collection(this.firestore, 'ganttTasks') as CollectionReference<GanttTaskItem>;
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

   deleteProject(projectId: string): Promise<void> {
    const projectDocRef = doc(this.firestore, 'Projects', projectId);
    return deleteDoc(projectDocRef);
   }

   // ... (addGanttTask メソッド内)
  addGanttTask(taskData: NewGanttTaskData): Promise<DocumentReference<GanttTaskItem>> {
    // Firestoreに保存するデータの型 (GanttTaskItemからidを除外し、日付はTimestampであることを期待)
    // NewGanttTaskData から id, createdAt, updatedAt を除いたものに、日付をTimestampに変換した形
    // もっとも、GanttTaskItem のオプショナルでないプロパティは必須となる
    const dataToSave: Omit<GanttTaskItem, 'id' | 'createdAt' | 'updatedAt'> & { plannedStartDate: Timestamp, plannedEndDate: Timestamp, actualStartDate?: Timestamp | null, actualEndDate?: Timestamp | null} = {
      // ...taskData から id, createdAt, updatedAt を除いたプロパティをコピー
      name: taskData.name,
      wbsNumber: taskData.wbsNumber,
      category: taskData.category,
      primaryAssigneeId: taskData.primaryAssigneeId,
      otherAssigneeIds: taskData.otherAssigneeIds,
      decisionMakerId: taskData.decisionMakerId,
      status: taskData.status,
      progress: taskData.progress,
      level: taskData.level,
      parentId: taskData.parentId,
      // 日付プロパティを Timestamp に変換して設定
      plannedStartDate: taskData.plannedStartDate instanceof Date ? Timestamp.fromDate(taskData.plannedStartDate) : taskData.plannedStartDate,
      plannedEndDate: taskData.plannedEndDate instanceof Date ? Timestamp.fromDate(taskData.plannedEndDate) : taskData.plannedEndDate,
      actualStartDate: taskData.actualStartDate instanceof Date ? Timestamp.fromDate(taskData.actualStartDate) : (taskData.actualStartDate === null ? null : taskData.actualStartDate),
      actualEndDate: taskData.actualEndDate instanceof Date ? Timestamp.fromDate(taskData.actualEndDate) : (taskData.actualEndDate === null ? null : taskData.actualEndDate),
    };

    // オプショナルなプロパティで、undefined の場合は Firestore に保存しないようにする (delete演算子を使うなど)
    // もしくは、taskData の時点で undefined のプロパティは除外されている前提で進める
    // ここでは、taskData に含まれるプロパティのみを dataToSave に展開しているため、
    // taskData にないオプショナルプロパティは dataToSave にも含まれない。

    return addDoc(this.ganttTasksCollection, {
      ...(dataToSave as GanttTaskItem), // Firestoreに保存する際はGanttTaskItemの形式（日付はTimestamp）
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
// ...

  /**
   * Firestoreからすべてのガントチャートタスクを取得する
   * @returns ガントチャートタスクの Observable 配列
   */
  getGanttTasks(): Observable<GanttTaskDisplayItem[]> { // ★ 返り値の型を変更
    return collectionData<GanttTaskItem>(this.ganttTasksCollection, { idField: 'id' }).pipe(
      map(tasks => tasks.map(task => {
        // Timestamp を Date に変換
        const plannedStartDate = task.plannedStartDate instanceof Timestamp ? task.plannedStartDate.toDate() : new Date(); // fallback
        const plannedEndDate = task.plannedEndDate instanceof Timestamp ? task.plannedEndDate.toDate() : new Date(); // fallback
        const actualStartDate = task.actualStartDate instanceof Timestamp ? task.actualStartDate.toDate() : null;
        const actualEndDate = task.actualEndDate instanceof Timestamp ? task.actualEndDate.toDate() : null;
        const createdAt = task.createdAt instanceof Timestamp ? task.createdAt.toDate() : undefined;
        const updatedAt = task.updatedAt instanceof Timestamp ? task.updatedAt.toDate() : undefined;

        return {
          ...task,
          plannedStartDate,
          plannedEndDate,
          actualStartDate,
          actualEndDate,
          createdAt,
          updatedAt,
        } as GanttTaskDisplayItem; // ★ 新しいインターフェースに型アサーション
      }))
    );
  }


  // updateGanttTask や deleteGanttTask も同様に将来的に追加
}
