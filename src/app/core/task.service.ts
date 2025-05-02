import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  collectionData, 
  DocumentData, 
  CollectionReference,
  doc,
  addDoc,
  docData,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  DocumentReference, 
  ServerTimestamp,
  Timestamp,
  query,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface Task {
  id: string;
  title: string;
  projectId: string;
  assigneeId: string;
  status: 'todo' | 'doing' | 'done';
  dueDate: Date | null;
  createdAt: Date;
}

type NewTaskData = Omit<Task, 'id' | 'createdAt'>;

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
  photos?: {
    before?: string;
    after?: string;
  } | null;
  comment?: string | null;
  createdAt: Timestamp;
}

@Injectable({
  providedIn: 'root'
})

export class TaskService {

  private firestore: Firestore = inject(Firestore);
  private tasksCollection: CollectionReference<DocumentData>;


  constructor() { 
    this.tasksCollection = collection(this.firestore, 'Tasks');
  }

  getTasks(): Observable<Task[]> {
    return collectionData<Task>(this.tasksCollection, { idField: 'id' });
  }

  getTask(taskId: string): Observable<Task | undefined> {
    const taskDocRef : DocumentReference<DocumentData> = doc(this.firestore, 'Tasks', taskId);
    return docData<Task>(taskDocRef, { idField: 'id' });
  }

  createTask(taskData: NewTaskData): Promise<DocumentReference<DocumentData>> {
    return addDoc(this.tasksCollection, {
      ...taskData,
      createdAt: serverTimestamp()
    });
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
    const taskDocRef = doc(this.firestore, 'Tasks', taskId);
    const dailyLogsCollectionRef = collection(taskDocRef, 'DailyLogs');
    const q = query(dailyLogsCollectionRef, orderBy('workDate', 'asc'));
    return collectionData<DailyLog>(q, { idField: 'id' });
  }

}
