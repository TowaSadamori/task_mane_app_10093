import { Timestamp, FieldValue } from '@angular/fire/firestore'; // FirestoreのTimestamp型とFieldValue型をインポート

export interface GanttChartTask {
  id?: string;                 // Firestoreが自動生成するIDなので、保存時は不要（読み取り時には在る）
  projectId: string;          // このタスクが属するプロジェクトのID
  title: string;              // タスクの名称（ガントチャートに表示する名前）
  plannedStartDate?: Timestamp | null;  // 予定開始日 (任意)
  plannedEndDate?: Timestamp | null;    // 予定終了日 (任意)
  actualStartDate?: Timestamp | null;   // 実績開始日 (任意)
  actualEndDate?: Timestamp | null;     // 実績終了日 (任意)
  status?: 'todo' | 'doing' | 'done' | null; // 状況 (任意、nullも許容)
  createdAt?: Timestamp;         // 作成日時 (FirestoreのserverTimestamp()で自動設定を想定)
  updatedAt?: Timestamp | FieldValue;   // 更新日時 (編集時にserverTimestamp()で自動設定)
  parentId?: string | null;
  level?: number;
}