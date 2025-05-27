import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { CommonModule, DatePipe } from '@angular/common';
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
  createdAt?: any;
  photoUrls?: string[];
  progressRate?: number;
  supervisor?: string;
  workDate?: any;
  workerCount?: number;
  [key: string]: any;
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
      }
    }
  }

  goBack() {
    if (this.ganttTaskId) {
      this.router.navigate(['/app/gantt-task-detail', this.ganttTaskId]);
    }
  }
}
