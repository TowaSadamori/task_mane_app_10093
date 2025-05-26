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
    try {
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
      data['createdAt'] = Timestamp.now();
      await addDoc(this.col, data);
    } catch (error) {
      console.error('addDailyReport error:', error);
      throw error;
    }
  }

  async getDailyReports(): Promise<DailyReport[]> {
    const q = query(this.col, orderBy('createdAt', 'desc'));
    console.log(`【Firestore】これからパス "dailyReports" からデータを取得します。`);
    try {
      const snap = await getDocs(q);
      const reports = snap.docs.map(doc => {
        const data = doc.data();
        // workDateがTimestamp型ならDate型に変換
        if (data['workDate'] && typeof data['workDate'] === 'object' && typeof data['workDate'].toDate === 'function') {
          data['workDate'] = data['workDate'].toDate();
        }
        return { id: doc.id, ...data } as DailyReport;
      });
      console.log(`【Firestore】パス "dailyReports" からデータ受信:`, reports);
      return reports;
    } catch (error) {
      console.error(`【Firestore】パス "dailyReports" のデータ取得エラー:`, error);
      throw error;
    }
  }

  async deleteDailyReport(id: string) {
    const ref = doc(this.firestore, 'dailyReports', id);
    try {
      await deleteDoc(ref);
    } catch (error) {
      console.error('deleteDailyReport error:', error);
      throw error;
    }
  }

  async updateDailyReport(id: string, report: DailyReport) {
    const ref = doc(this.firestore, 'dailyReports', id);
    try {
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
      await updateDoc(ref, data as DocumentData);
    } catch (error) {
      console.error('updateDailyReport error:', error);
      throw error;
    }
  }

} 