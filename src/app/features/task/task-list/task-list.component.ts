import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
// Task の隣に TaskDisplay を追加
import { TaskService, TaskDisplay } from '../../../core/task.service';
import { MatListModule } from '@angular/material/list';
import { MatTableModule } from '@angular/material/table';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatTableModule,
    DatePipe,
  ],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.scss'
})

export class TaskListComponent implements OnInit {
  private taskService = inject(TaskService);
  // Observable<Task[]> から Observable<TaskDisplay[]> へ変更
  tasks$!: Observable<TaskDisplay[]>;

  displayedColumns: string[] = ['id', 'title', 'status', 'projectId', 'assigneeId', 'dueDate', 'createdAt'];

  // constructor() {}

  ngOnInit(): void {
    this.tasks$ = this.taskService.getTasks();
  }
}