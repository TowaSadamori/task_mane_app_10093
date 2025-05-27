import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-gantt-daily-log-detail',
  standalone: true,
  imports: [],
  templateUrl: './gantt-daily-log-detail.component.html',
  styleUrl: './gantt-daily-log-detail.component.scss'
})
export class GanttDailyLogDetailComponent implements OnInit {
  ganttTaskId: string | null = null;
  logId: string | null = null;
  workLog: any = null;

  constructor(private router: Router) {}

  async ngOnInit() {
    // ... 既存のngOnInit ...
  }

  goBack() {
    if (this.ganttTaskId) {
      this.router.navigate(['/app/gantt-task-detail', this.ganttTaskId]);
    }
  }
}
