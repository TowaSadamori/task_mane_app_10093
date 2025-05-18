import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Project, ProjectService } from '../../core/project.service'; // ProjectService と Project をインポート
import { Observable } from 'rxjs';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { map } from 'rxjs/operators';
import { Timestamp } from 'firebase/firestore'; // or from firebase-admin if using admin SDK

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'] // SCSSファイルも用意する想定
})


export class DashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private router = inject(Router);
  projects$!: Observable<Project[]>;

  ngOnInit(): void {
    this.projects$ = this.projectService.getProjects().pipe(
      map(projects => projects.map(project => ({
        ...project,
        startDate: project.startDate instanceof Timestamp ? project.startDate.toDate() : project.startDate,
        endDate: project.endDate instanceof Timestamp ? project.endDate.toDate() : project.endDate,
      })))
    );
  }


   navigateToGantt(projectId: string): void {
    if (projectId) {
      this.router.navigate(['/app/projects', projectId, 'gantt']);
    } else {
      console.error('Project ID is missing, cannot navigate.');
    }
  }

  navigateToCreateProject(): void {
    this.router.navigate(['/app/projects/new'])
  }

  
  editProject(projectId: string, event: MouseEvent): void {
    event.stopPropagation(); // 親要素のクリックイベント(navigateToGantt)が発火しないようにする
    console.log('Edit project:', projectId, '- NOT IMPLEMENTED YET');
    // TODO: プロジェクト編集画面への遷移ロジック (例: this.router.navigate(['/app/projects', projectId, 'edit']);)
    alert(`プロジェクト「${projectId}」の編集機能は準備中です。`);
  }

  deleteProject(projectId: string, projectName: string, event: MouseEvent): void {
    event.stopPropagation(); // 親要素のクリックイベント(navigateToGantt)が発火しないようにする
    console.log('Delete project:', projectId, '- NOT IMPLEMENTED YET');
    // TODO: 確認ダイアログを表示し、ProjectService.deleteProject(projectId) を呼び出す
    // const confirmDelete = confirm(`プロジェクト「${projectName}」を削除してもよろしいですか？この操作は取り消せません。`);
    // if (confirmDelete) {
    //   this.projectService.deleteProject(projectId)
    //     .then(() => {
    //       alert(`プロジェクト「${projectName}」を削除しました。`);
    //       this.projects$ = this.projectService.getProjects(); // リストを再読み込み
    //     })
    //     .catch(err => {
    //       alert(`プロジェクト「${projectName}」の削除に失敗しました。`);
    //       console.error(err);
    //     });
    // }
    alert(`プロジェクト「${projectName}」の削除機能は準備中です。`);
  }

  public toDate(val: unknown): Date | null {
    if (!val) return null;
    if (val instanceof Date) return val;
    if (
      typeof val === 'object' &&
      val !== null &&
      'toDate' in val &&
      typeof (val as { toDate: () => Date }).toDate === 'function'
    ) {
      return (val as { toDate: () => Date }).toDate(); // Firestore Timestamp
    }
    return null;
  }
}