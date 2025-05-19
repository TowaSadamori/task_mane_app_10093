import { Timestamp } from '@angular/fire/firestore'; // FirestoreのTimestamp型をインポート
import { Task } from '../task.service';

export interface GanttChartTask extends Task {
  id: string;                 // Firestoreが自動生成するIDなので、保存時は不要（読み取り時には在る）
  projectId: string;          // このタスクが属するプロジェクトのID
  title: string;              // タスクの名称（ガントチャートに表示する名前）
  plannedStartDate: Timestamp;  // 予定開始日 (FirestoreのTimestamp型で保存)
  plannedEndDate: Timestamp;    // 予定終了日 (FirestoreのTimestamp型で保存)
  createdAt: Timestamp;
  status: 'todo' | 'doing' | 'done';
  progress?: number;
  actualStartDate?: Timestamp | null;
  actualEndDate?: Timestamp | null;
  parentId?: string | null;
  level?: number;
  memo?: string | null;
}