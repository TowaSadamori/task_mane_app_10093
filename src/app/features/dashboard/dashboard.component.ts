import { Component, OnInit, inject } from '@angular/core'; // inject をインポート
import { Observable } from 'rxjs';
import { Project, ProjectService } from '../../core/project.service'; // ProjectService のパスを確認・修正
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProjectCreateComponent } from '../project/components/project-create/project-create.component';
// import { ProjectService as ProjectServiceType } from '../../core/project.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { filter, switchMap } from 'rxjs/operators';
import { Timestamp } from '@angular/fire/firestore';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TaskService } from '../../core/task.service';
import { UserService } from '../../core/user.service';
import { User as AppUser } from '../../core/models/user.model';
import { AuthService } from '../../core/auth.service';
// import { GanttChartTask } from '../../core/models/gantt-chart-task.model';
// import { AuthService } from '../../auth/auth.service'; // ユーザーに紐づくプロジェクトを取得する場合

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'] // styleUrls に修正 (単数形でも動くが複数形が一般的)
})
export class DashboardComponent implements OnInit {
  projects$: Observable<Project[]> | undefined;
  filteredProjects: Project[] = [];
  private projectService: ProjectService = inject(ProjectService);
  private dialog: MatDialog = inject(MatDialog);
  private taskService = inject(TaskService);
  private userService: UserService = inject(UserService);
  private authService: AuthService = inject(AuthService);
  progressMap: Record<string, number> = {};
  userMap: Record<string, AppUser> = {};
  currentUserUid: string | null = null;
  // private authService?: AuthService; // 必要に応じて

  constructor() {
    // もしAuthServiceも使う場合はここで inject するか、constructor DI を使う
    // if (/* ユーザーに紐づくプロジェクトが必要な条件 */) {
    // this.authService = inject(AuthService);
    // }
  }

  ngOnInit(): void {
    this.authService.getCurrentUser().then(user => {
      this.currentUserUid = user?.uid || null;
      this.loadProjects();
    });

    // 特定ユーザーのプロジェクトを取得する場合のロジック (必要であれば)
    // this.authService?.user$.subscribe(user => { // user$ が AuthService にあると仮定
    //   if (user) {
    //     // this.projects$ = this.projectService.getProjectsByUserId(user.uid); // ProjectServiceにそのようなメソッドがあれば
    //   } else {
    //     this.projects$ = undefined; // または空のObservable
    //   }
    // });
  }

  loadProjects(): void {
    this.projects$ = this.projectService.getProjects();
    this.projects$?.subscribe(projects => {
      // フィルタリング: 管理者または担当者に自分が含まれるプロジェクトのみ
      this.filteredProjects = projects.filter(project => {
        const managerIds = project.managerIds ?? (project.managerId ? [project.managerId] : []);
        const memberIds = project.members ?? [];
        return this.currentUserUid && (managerIds.includes(this.currentUserUid) || memberIds.includes(this.currentUserUid));
      });
      projects.forEach(project => {
        this.taskService.getGanttChartTasksByProjectId(project.id).subscribe(tasks => {
          if (tasks.length === 0) {
            this.progressMap[project.id] = 0;
          } else {
            const doneCount = tasks.filter(t => t.status === 'done').length;
            this.progressMap[project.id] = Math.round((doneCount / tasks.length) * 100);
          }
        });
      });
      const allUserIds = Array.from(new Set(projects.flatMap(p => [
        ...(p.managerIds ?? (p.managerId ? [p.managerId] : [])),
        ...(p.members ?? [])
      ])));
      if (allUserIds.length > 0) {
        this.userService.getUsersByIds(allUserIds).subscribe(users => {
          this.userMap = {};
          users.forEach(u => { this.userMap[u.id] = u; });
        });
      }
    });
  }

  getProjectProgress(projectId: string): number {
    return this.progressMap[projectId] ?? 0;
  }

  openCreateProjectDialog(): void {
    // console.log('DashboardComponent: openCreateProjectDialog method CALLED!'); // ★ デバッグ用ログ
    const dialogRef = this.dialog.open(ProjectCreateComponent, {
      width: '600px',
      disableClose: true,
      data: { project: null }
    });
    dialogRef.afterClosed().subscribe(result => {
      // console.log('プロジェクト作成ダイアログの結果 (DashboardComponent):', result);
      if (result) {
        this.loadProjects();
      }
    });
  }

  openEditProjectDialog(projectToEdit: Project): void {
    if (!projectToEdit || !projectToEdit.id) {
      // console.error('編集対象のプロジェクト情報が無効です。');
      return;
    }
    const dialogRef = this.dialog.open(ProjectCreateComponent, {
      width: '600px',
      disableClose: true,
      data: { project: projectToEdit }
    });
    dialogRef.afterClosed().subscribe(result => {
      // console.log('プロジェクト編集ダイアログの結果:', result);
      if (result) {
        this.loadProjects();
      }
    });
  }

  confirmDeleteProject(projectToDelete: Project): void {
    if (!projectToDelete || !projectToDelete.id) {
      // console.error('削除対象のプロジェクト情報が無効です。');
      alert('削除対象のプロジェクト情報が見つかりませんでした。');
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '350px',
      // data: { message: `プロジェクト「${projectToDelete.name}」を本当に削除してもよろしいですか？関連するタスクもすべて削除されます。` }
    });

    dialogRef.afterClosed().pipe(
      filter(result => result === true),
      switchMap(() => this.projectService.deleteProjectAndTasks(projectToDelete.id))
    ).subscribe({
      next: () => {
        // console.log(`プロジェクト (ID: ${projectToDelete.id}) および関連タスクが正常に削除されました。`);
        alert(`プロジェクト「${projectToDelete.name}」を削除しました。`);
        this.loadProjects();
      },
      error: () => {
        // console.error(`プロジェクト (ID: ${projectToDelete.id}) の削除中にエラーが発生しました:`);
        alert(`プロジェクト「${projectToDelete.name}」の削除に失敗しました。`);
      }
    });
  }

  toDateSafe(value: Date | Timestamp | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (this.isTimestamp(value)) return value.toDate();
    return null;
  }

  private isTimestamp(obj: unknown): obj is Timestamp {
    return !!obj && typeof (obj as Timestamp).toDate === 'function';
  }

  getUserNamesByIds(ids: string[] | undefined): string[] {
    if (!ids) return [];
    return ids.map(id => this.userMap[id]?.displayName || id);
  }
}
