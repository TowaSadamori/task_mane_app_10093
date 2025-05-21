import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Firestore, doc, getDoc, updateDoc, DocumentData } from '@angular/fire/firestore';
import { GanttChartTask } from '../../../core/models/gantt-chart-task.model';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AddTaskDialogComponent } from '../gantt-chart/components/add-task-dialog/add-task-dialog.component';
import { TimestampToDatePipe } from '../../../shared/pipes/timestamp-to-date.pipe';

@Component({
  selector: 'app-gantt-task-detail',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, TimestampToDatePipe],
  templateUrl: './gantt-task-detail.component.html',
  styleUrls: ['./gantt-task-detail.component.scss']
})
export class GanttTaskDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  ganttTaskId: string | null = null;
  ganttTask: GanttChartTask | null = null;

  async ngOnInit() {
    this.ganttTaskId = this.route.snapshot.paramMap.get('ganttTaskId');
    if (this.ganttTaskId) {
      const docRef = doc(this.firestore, 'GanttChartTasks', this.ganttTaskId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.ganttTask = docSnap.data() as GanttChartTask;
      }
    }
  }

  navigateToGanttChart(): void {
    if (this.ganttTask?.projectId) {
      this.router.navigate(['/app/gantt-chart', this.ganttTask.projectId]);
    } else {
      this.router.navigate(['/app/gantt-chart']);
    }
  }

  private removeUndefinedFields(obj: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
  }

  openEditDialog(): void {
    if (!this.ganttTask) return;
    const dialogRef = this.dialog.open(AddTaskDialogComponent, {
      width: '500px',
      data: { task: this.ganttTask, isEditMode: true, projectId: this.ganttTask.projectId }
    });

    dialogRef.afterClosed().subscribe(async result => {
      console.log('編集ダイアログから返されたresult:', result);
      if (result && this.ganttTaskId) {
        try {
          const docRef = doc(this.firestore, 'GanttChartTasks', this.ganttTaskId);
          const cleanedResult = this.removeUndefinedFields(result);
          await updateDoc(docRef, cleanedResult as DocumentData);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            this.ganttTask = docSnap.data() as GanttChartTask;
          }
        } catch (e) {
          console.error('Firestore updateDocエラー:', e);
        }
      }
    });
  }
} 