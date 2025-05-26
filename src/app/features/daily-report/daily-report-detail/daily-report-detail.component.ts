import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, collectionGroup, query, where, getDocs } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';

interface WorkLog {
  workDate?: { toDate: () => Date };
  supervisor?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  actualBreakTime?: number;
  progressRate?: number;
  workerCount?: number;
  comment?: string;
  photoUrls?: string[];
  [key: string]: unknown;
}

@Component({
  selector: 'app-daily-report-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-report-detail.component.html',
  styleUrl: './daily-report-detail.component.scss'
})
export class DailyReportDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);

  dailyReportId: string | null = null;
  ganttTaskId: string | null = null;
  workLog: WorkLog | null = null;

  async ngOnInit() {
    this.dailyReportId = this.route.snapshot.paramMap.get('dailyReportId');
    if (this.dailyReportId) {
      // コレクショングループクエリでWorkLogsからganttTaskIdとWorkLogデータを取得
      const q = query(
        collectionGroup(this.firestore, 'WorkLogs'),
        where('id', '==', this.dailyReportId)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        // パス例: GanttChartTasks/{ganttTaskId}/WorkLogs/{logId}
        const pathSegments = docSnap.ref.path.split('/');
        this.ganttTaskId = pathSegments[1];
        this.workLog = docSnap.data() as WorkLog;
      }
    }
  }

  navigateToTaskDetail() {
    if (this.ganttTaskId) {
      this.router.navigate(['/app/gantt-task-detail', this.ganttTaskId]);
    }
  }
}
