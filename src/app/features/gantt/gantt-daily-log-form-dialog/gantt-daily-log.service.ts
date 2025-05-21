import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, CollectionReference, Timestamp, serverTimestamp, collectionData, query, orderBy, DocumentReference, doc, deleteDoc } from '@angular/fire/firestore';
import { Observable } from 'rxjs';

export interface GanttDailyLog {
  id?: string;
  workDate: Timestamp;
  actualStartTime: string;
  actualEndTime: string;
  actualBreakTime: number;
  progressRate: number;
  workerCount: number;
  supervisor: string;
  comment?: string;
  photoUrls?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

@Injectable({ providedIn: 'root' })
export class GanttDailyLogService {
  private firestore: Firestore = inject(Firestore);

  getDailyLogs(ganttTaskId: string): Observable<GanttDailyLog[]> {
    const logsRef = collection(this.firestore, `GanttChartTasks/${ganttTaskId}/WorkLogs`) as CollectionReference<GanttDailyLog>;
    const logsQuery = query(logsRef, orderBy('workDate', 'desc'), orderBy('updatedAt', 'desc'));
    return collectionData(logsQuery, { idField: 'id' });
  }

  async addDailyLog(ganttTaskId: string, log: GanttDailyLog): Promise<DocumentReference<GanttDailyLog>> {
    const logsRef = collection(this.firestore, `GanttChartTasks/${ganttTaskId}/WorkLogs`) as CollectionReference<GanttDailyLog>;
    return addDoc(logsRef, {
      ...log,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteDailyLog(ganttTaskId: string, logId: string): Promise<void> {
    const logRef = doc(this.firestore, `GanttChartTasks/${ganttTaskId}/WorkLogs/${logId}`);
    await deleteDoc(logRef);
  }
} 