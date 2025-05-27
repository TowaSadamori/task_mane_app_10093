import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, Timestamp } from '@angular/fire/firestore';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface WorkLog {
  id?: string;
  actualBreakTime?: number;
  actualEndTime?: string;
  actualStartTime?: string;
  assigneeId?: string;
  assignees?: string[];
  blockerStatus?: string;
  comment?: string;
  createdAt?: Date | Timestamp | string | undefined;
  photoUrls?: string[];
  progressRate?: number;
  supervisor?: string;
  workDate?: Date | Timestamp | string | undefined;
  workerCount?: number;
  [key: string]: unknown;
}

@Component({
  selector: 'app-gantt-daily-log-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './gantt-daily-log-detail.component.html',
  styleUrl: './gantt-daily-log-detail.component.scss'
})
export class GanttDailyLogDetailComponent implements OnInit {
  ganttTaskId: string | null = null;
  logId: string | null = null;
  workLog: WorkLog | null = null;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);

  async ngOnInit() {
    this.ganttTaskId = this.route.snapshot.paramMap.get('ganttTaskId');
    this.logId = this.route.snapshot.paramMap.get('logId');
    if (this.ganttTaskId && this.logId) {
      const logRef = doc(this.firestore, `GanttChartTasks/${this.ganttTaskId}/WorkLogs/${this.logId}`);
      const logSnap = await getDoc(logRef);
      if (logSnap.exists()) {
        this.workLog = { id: logSnap.id, ...logSnap.data() };
        const taskRef = doc(this.firestore, 'GanttChartTasks', this.ganttTaskId);
        const taskSnap = await getDoc(taskRef);
        if (taskSnap.exists()) {
          this.workLog['taskName'] = taskSnap.data()['title'] || '';
        }
      }
    }
  }

  goBack() {
    if (this.ganttTaskId) {
      this.router.navigate(['/app/gantt-task-detail', this.ganttTaskId]);
    }
  }

  get formattedWorkDate(): string {
    if (!this.workLog || !this.workLog.workDate) return '-';
    const wd: string | Date | { toDate?: () => Date } = this.workLog.workDate;
    if (typeof wd === 'string') {
      const d = new Date(wd);
      return isNaN(d.getTime()) ? wd : d.toLocaleDateString('ja-JP');
    }
    if (typeof wd === 'object' && wd !== null && 'toDate' in wd && typeof wd.toDate === 'function') {
      return wd.toDate().toLocaleDateString('ja-JP');
    }
    if (wd instanceof Date) {
      return wd.toLocaleDateString('ja-JP');
    }
    return '-';
  }
}
