import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';

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

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private firestore = inject(Firestore);

  async ngOnInit() {
    this.ganttTaskId = this.route.snapshot.paramMap.get('ganttTaskId');
    this.logId = this.route.snapshot.paramMap.get('logId');
    // Firestoreからデータ取得処理は今後追加
  }

  goBack() {
    if (this.ganttTaskId) {
      this.router.navigate(['/app/gantt-task-detail', this.ganttTaskId]);
    }
  }
}
