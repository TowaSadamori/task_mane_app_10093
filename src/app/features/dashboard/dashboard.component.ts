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
import { GanttChartTask } from '../../core/models/gantt-chart-task.model';
import { DailyReportService } from '../../features/daily-report/daily-report.service';
import { Firestore, collectionGroup, query, getDocs } from '@angular/fire/firestore';
// import { AuthService } from '../../auth/auth.service'; // ユーザーに紐づくプロジェクトを取得する場合

// WorkLog+タスク名・プロジェクト名用型
interface WorkLogWithTaskProject {
  id: string;
  ganttTaskId: string;
  assigneeId: string;
  supervisor?: string;
  workDate?: Date | { toDate: () => Date } | string;
  taskName: string;
  projectName: string;
}

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
  myTasks: GanttChartTask[] = [];
  private projectService: ProjectService = inject(ProjectService);
  private dialog: MatDialog = inject(MatDialog);
  private taskService = inject(TaskService);
  private userService: UserService = inject(UserService);
  private authService: AuthService = inject(AuthService);
  progressMap: Record<string, number> = {};
  userMap: Record<string, AppUser> = {};
  currentUserUid: string | null = null;
  projectMap: Record<string, Project> = {};
  myDailyReports: WorkLogWithTaskProject[] = [];
  private dailyReportService: DailyReportService = inject(DailyReportService);
  private firestore: Firestore = inject(Firestore);
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
      this.loadMyTasks();
      this.loadMyDailyReports();
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
      this.filteredProjects = projects.filter(project => {
        const managerIds = project.managerIds ?? (project.managerId ? [project.managerId] : []);
        const memberIds = project.members ?? [];
        return this.currentUserUid && (managerIds.includes(this.currentUserUid) || memberIds.includes(this.currentUserUid));
      });
      // プロジェクトID→プロジェクト名用マップ
      this.projectMap = {};
      projects.forEach(p => { this.projectMap[p.id] = p; });
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

  loadMyTasks(): void {
    if (!this.currentUserUid) return;
    // 全プロジェクトのタスクを横断的に取得
    this.projectService.getProjects().subscribe(projects => {
      const allProjectIds = projects.map(p => p.id);
      let allTasks: GanttChartTask[] = [];
      let loadedCount = 0;
      allProjectIds.forEach(projectId => {
        this.taskService.getGanttChartTasksByProjectId(projectId).subscribe(tasks => {
          // 自分が担当のタスクだけ抽出
          const myTasks = tasks.filter(task => (task.assignees ?? []).includes(this.currentUserUid!) && task.status !== 'done');
          allTasks = allTasks.concat(myTasks);
          loadedCount++;
          if (loadedCount === allProjectIds.length) {
            this.myTasks = allTasks;
          }
        });
      });
    });
  }

  async loadMyDailyReports(): Promise<void> {
    // ユーザーで絞り込まず、全てのWorkLogを取得
    const q = query(
      collectionGroup(this.firestore, 'WorkLogs')
      // where句を外すことで全件取得
    );
    const querySnapshot = await getDocs(q);
    const reports: WorkLogWithTaskProject[] = [];
    const ganttTaskIdSet = new Set<string>();
    querySnapshot.forEach(docSnap => {
      const pathSegments = docSnap.ref.path.split('/');
      const ganttTaskId = pathSegments[1];
      ganttTaskIdSet.add(ganttTaskId);
      const data = docSnap.data();
      reports.push({
        ...data,
        id: docSnap.id,
        ganttTaskId: ganttTaskId,
        assigneeId: data['supervisor'] || data['assigneeId'] || '',
        taskName: '',
        projectName: ''
      });
    });
    // タスク名・プロジェクトIDをまとめて取得
    const ganttTaskIdArr = Array.from(ganttTaskIdSet);
    const ganttTaskMap: Record<string, { title: string; projectId: string }> = {};
    for (const ganttTaskId of ganttTaskIdArr) {
      const taskDocRef = (await import('@angular/fire/firestore')).doc(this.firestore, 'GanttChartTasks', ganttTaskId);
      const taskDocSnap = await (await import('@angular/fire/firestore')).getDoc(taskDocRef);
      if (taskDocSnap.exists()) {
        const data = taskDocSnap.data() as { title?: string; projectId?: string };
        ganttTaskMap[ganttTaskId] = { title: data.title || '', projectId: data.projectId || '' };
      }
    }
    // プロジェクト名もまとめて取得
    const projectIdSet = new Set<string>(Object.values(ganttTaskMap).map(t => t.projectId).filter(Boolean));
    const projectIdArr = Array.from(projectIdSet);
    const projectMap: Record<string, { name: string }> = {};
    for (const projectId of projectIdArr) {
      const projectDocRef = (await import('@angular/fire/firestore')).doc(this.firestore, 'Projects', projectId);
      const projectDocSnap = await (await import('@angular/fire/firestore')).getDoc(projectDocRef);
      if (projectDocSnap.exists()) {
        const data = projectDocSnap.data() as { name?: string };
        projectMap[projectId] = { name: data.name || '' };
      }
    }
    // displayName取得
    const myDisplayName = this.userMap[this.currentUserUid || '']?.displayName;
    this.myDailyReports = reports
      .filter(r => {
        // supervisorまたはassigneeIdがdisplayNameと一致するものだけ
        return (
          (r['supervisor'] && r['supervisor'] === myDisplayName) ||
          (r['assigneeId'] && r['assigneeId'] === myDisplayName)
        );
      })
      .map(r => ({
        ...r,
        taskName: ganttTaskMap[r['ganttTaskId']]?.title || '-',
        projectName: projectMap[ganttTaskMap[r['ganttTaskId']]?.projectId || '']?.name || '-'
      }));
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

  toDateSafe(value: Date | Timestamp | string | { toDate: () => Date } | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (this.isTimestamp(value)) return value.toDate();
    if (typeof value === 'object' && value !== null && typeof (value as unknown as { toDate?: () => Date }).toDate === 'function') {
      return (value as unknown as { toDate: () => Date }).toDate();
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  private isTimestamp(obj: unknown): obj is Timestamp {
    return !!obj && typeof (obj as Timestamp).toDate === 'function';
  }

  getUserNamesByIds(ids: string[] | undefined): string[] {
    if (!ids) return [];
    return ids.map(id => this.userMap[id]?.displayName || id);
  }

  getProjectName(projectId: string): string {
    return this.projectMap[projectId]?.name || projectId;
  }

  getDisplayNameByUid(uid: string): string {
    const user = this.userMap[uid];
    return user ? user.displayName : uid;
  }

  canEditProject(project: Project): boolean {
    if (!this.currentUserUid || !this.userMap[this.currentUserUid]) return false;
    const myDisplayName = this.userMap[this.currentUserUid].displayName;
    const managerDisplayNames = this.getUserNamesByIds(project.managerIds ?? (project.managerId ? [project.managerId] : []));
    return managerDisplayNames.includes(myDisplayName);
  }
}
