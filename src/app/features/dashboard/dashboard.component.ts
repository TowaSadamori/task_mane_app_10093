import { Component, OnInit, inject } from '@angular/core'; // inject をインポート
import { Observable } from 'rxjs';
import { Project, ProjectService } from '../../core/project.service'; // ProjectService のパスを確認・修正
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProjectCreateComponent } from '../project/components/project-create/project-create.component';
import { ProjectService as ProjectServiceType } from '../../core/project.service';
// import { AuthService } from '../../auth/auth.service'; // ユーザーに紐づくプロジェクトを取得する場合

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'] // styleUrls に修正 (単数形でも動くが複数形が一般的)
})
export class DashboardComponent implements OnInit {
  projects$: Observable<Project[]> | undefined;
  private projectService: ProjectService = inject(ProjectService); // inject を使用
  private dialog: MatDialog = inject(MatDialog);
  // private authService?: AuthService; // 必要に応じて

  constructor() {
    // もしAuthServiceも使う場合はここで inject するか、constructor DI を使う
    // if (/* ユーザーに紐づくプロジェクトが必要な条件 */) {
    // this.authService = inject(AuthService);
    // }
  }

  ngOnInit(): void {
    this.loadProjects();

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
  }

  openCreateProjectDialog(): void {
    console.log('DashboardComponent: openCreateProjectDialog method CALLED!'); // ★ デバッグ用ログ
    const dialogRef = this.dialog.open(ProjectCreateComponent, {
      width: '600px',
      disableClose: true,
      data: { project: null }
    });
    dialogRef.afterClosed().subscribe(result => {
      console.log('プロジェクト作成ダイアログの結果 (DashboardComponent):', result);
      if (result) {
        this.loadProjects();
      }
    });
  }

  openEditProjectDialog(projectToEdit: Project): void {
    if (!projectToEdit || !projectToEdit.id) {
      console.error('編集対象のプロジェクト情報が無効です。');
      return;
    }
    const dialogRef = this.dialog.open(ProjectCreateComponent, {
      width: '600px',
      disableClose: true,
      data: { project: projectToEdit }
    });
    dialogRef.afterClosed().subscribe(result => {
      console.log('プロジェクト編集ダイアログの結果:', result);
      if (result) {
        this.loadProjects();
      }
    });
  }

  confirmDeleteProject(projectToDelete: Project): void {
    if (!projectToDelete || !projectToDelete.id) {
      console.error('削除対象のプロジェクト情報が無効です。');
      return;
    }
    const projectName = projectToDelete.name;
    if (confirm(`プロジェクト「${projectName}」(ID: ${projectToDelete.id}) と関連するすべてのタスクを削除してもよろしいですか？\nこの操作は取り消せません。`)) {
      (this.projectService as ProjectServiceType & { deleteProjectAndTasks: (id: string) => Promise<void> }).deleteProjectAndTasks(projectToDelete.id)
        .then(() => {
          alert(`プロジェクト「${projectName}」を削除しました。`);
          this.loadProjects();
        })
        .catch((error: unknown) => {
          if (error instanceof Error) {
            console.error(`プロジェクト「${projectName}」の削除中にエラーが発生しました:`, error.message);
            alert(`プロジェクト「${projectName}」の削除に失敗しました。エラー: ${error.message}`);
          } else {
            console.error(`プロジェクト「${projectName}」の削除中にエラーが発生しました:`, error);
            alert(`プロジェクト「${projectName}」の削除に失敗しました。`);
          }
        });
    }
  }
}
