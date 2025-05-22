import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, CollectionReference, DocumentData, Timestamp, query, orderBy, doc, deleteDoc, updateDoc } from '@angular/fire/firestore';
import { DailyReport } from './daily-report.component';

@Injectable({ providedIn: 'root' })
export class DailyReportService {
  private col: CollectionReference<DocumentData>;
  constructor(private firestore: Firestore) {
    this.col = collection(this.firestore, 'dailyReports');
  }

  async addDailyReport(report: DailyReport) {
    // Firestoreに保存するため、日付やファイル型を変換
    const data: Record<string, unknown> = { ...report };
    if (data['workDate'] instanceof Date) {
      data['workDate'] = Timestamp.fromDate(data['workDate'] as Date);
    }
    // 写真はファイル名だけ保存（Storage連携は後で）
    if (Array.isArray(data['photos'])) {
      data['photoNames'] = (data['photos'] as File[]).map((f: File) => f.name);
      delete data['photos'];
    }
    if (report['photoUrls']) {
      data['photoUrls'] = report['photoUrls'];
    }
    data['createdAt'] = Timestamp.now();
    await addDoc(this.col, data);
  }

  async getDailyReports(): Promise<DailyReport[]> {
    const q = query(this.col, orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      // workDateがTimestamp型ならDate型に変換
      if (data['workDate'] && typeof data['workDate'] === 'object' && typeof data['workDate'].toDate === 'function') {
        data['workDate'] = data['workDate'].toDate();
      }
      return { id: doc.id, ...data } as DailyReport;
    });
  }

  async deleteDailyReport(id: string) {
    const ref = doc(this.firestore, 'dailyReports', id);
    await deleteDoc(ref);
  }

  async updateDailyReport(id: string, report: DailyReport) {
    const ref = doc(this.firestore, 'dailyReports', id);
    const data: Record<string, unknown> = { ...report };
    if (data['workDate'] instanceof Date) {
      data['workDate'] = Timestamp.fromDate(data['workDate'] as Date);
    }
    if (Array.isArray(data['photos'])) {
      data['photoNames'] = (data['photos'] as File[]).map((f: File) => f.name);
      delete data['photos'];
    }
    if (report['photoUrls']) {
      data['photoUrls'] = report['photoUrls'];
    }
    delete data['id'];
    await updateDoc(ref, data as any);
  }
} 