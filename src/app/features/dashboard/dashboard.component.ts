import { Component, OnInit, inject } from '@angular/core'; // inject をインポート
import { Observable } from 'rxjs';
import { Project, ProjectService } from '../../core/project.service'; // ProjectService のパスを確認・修正
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
// import { AuthService } from '../../auth/auth.service'; // ユーザーに紐づくプロジェクトを取得する場合

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'] // styleUrls に修正 (単数形でも動くが複数形が一般的)
})
export class DashboardComponent implements OnInit {
  projects$: Observable<Project[]> | undefined;
  private projectService: ProjectService = inject(ProjectService); // inject を使用
  // private authService?: AuthService; // 必要に応じて

  constructor() {
    // もしAuthServiceも使う場合はここで inject するか、constructor DI を使う
    // if (/* ユーザーに紐づくプロジェクトが必要な条件 */) {
    // this.authService = inject(AuthService);
    // }
  }

  ngOnInit(): void {
    this.projects$ = this.projectService.getProjects();

    // 特定ユーザーのプロジェクトを取得する場合のロジック (必要であれば)
    // this.authService?.user$.subscribe(user => { // user$ が AuthService にあると仮定
    //   if (user) {
    //     // this.projects$ = this.projectService.getProjectsByUserId(user.uid); // ProjectServiceにそのようなメソッドがあれば
    //   } else {
    //     this.projects$ = undefined; // または空のObservable
    //   }
    // });
  }
}
