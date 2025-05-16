import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component'; 
import { AuthGuard } from './core/auth.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component'; 
import { UserCreateComponent } from './features/admin/components/user-create/user-create.component';
import { ProjectFormComponent } from './features/project/components/project-form/project-form.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },

  {
    path: 'register', // 新規登録用のパス
    component: UserCreateComponent
    // ここには AuthGuard は適用しない
  },

  {
    path: 'app',
    component: AppLayoutComponent, 
    canActivate: [AuthGuard],  
    children: [


      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, 
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'tasks',
        loadComponent: () => import('./features/task/task-list/task-list.component').then(m => m.TaskListComponent)
      },
      {
        path: 'tasks/:taskId',
        loadComponent: () => import('./features/task/task/task-detail/task-detail.component').then(m => m.TaskDetailComponent)
      },

      // app.routes.ts の children 配列内
      {
        path: 'projects/:projectId/gantt', // ★ この形式になっているか確認
        loadComponent: () => import('./features/gantt/gantt-chart/gantt-chart.component').then(m => m.GanttChartComponent)
      },

      {
        path: 'gantt-chart',
        loadComponent: () => import('./features/gantt/gantt-chart/gantt-chart.component').then(m => m.GanttChartComponent)
      },

      {
        path: 'admin/user-create', // URLは /app/admin/user-create になります
        component: UserCreateComponent
        // TODO: 必要であれば、管理者専用のAuthGuard (例: AdminGuard) を canActivate に追加
        // canActivate: [AuthGuard, AdminGuard],
      },

      {
        path: 'register',
        component: UserCreateComponent
      },

      {
        path: 'projects/new', // ダッシュボードから遷移するパス
        component: ProjectFormComponent // ProjectFormComponent を直接指定
      },


    ]
  },
  // {
  //   path: 'admin-create-test',
  //   component: UserCreateComponent
  // },
  {
    path: '',
    redirectTo: '/login', // ★ ログイン画面をデフォルトに
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/login' // ★ 不明なパスもログイン画面へ
  }

];