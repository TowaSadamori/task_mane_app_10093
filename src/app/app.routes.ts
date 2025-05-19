import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component'; 
import { AuthGuard } from './core/auth.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component'; 
import { UserCreateComponent } from './features/admin/components/user-create/user-create.component';
import { UserSettingsComponent } from './features/user/user-settings/user-settings.component';
// import { AdminGuard } from './core/guards/admin.guard';
// import { UserCreateComponent } from './features/admin/components/user-create/user-create.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'signup',
    component: UserCreateComponent
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
      {
        path: 'gantt-chart',
        loadComponent: () => import('./features/gantt/gantt-chart/gantt-chart.component').then(m => m.GanttChartComponent)
      },
      {
        path: 'gantt-chart/:projectId', // :projectId パラメータを受け取る
        loadComponent: () => import('./features/gantt/gantt-chart/gantt-chart.component').then(m => m.GanttChartComponent)
      },
      {
        path: 'user-settings',
        component: UserSettingsComponent
      },
      // {
      //   path: 'projects/create', // 新規作成画面のパス
      //   loadComponent: () => import('./features/project/components/project-create/project-create.component').then(m => m.ProjectCreateComponent)
      //   // ↑ ProjectCreateComponent の実際のパスに合わせてください
      // },
      // {
      //   path: 'admin/create-user',
      //   component: UserCreateComponent,
      //   canActivate: [AdminGuard]
      // }
    ]
  },
  // {
  //   path: 'admin-create-test',
  //   component: UserCreateComponent
  // },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/login' 
  }
];