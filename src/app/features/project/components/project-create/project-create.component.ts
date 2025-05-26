import { Component, OnInit, inject, Inject, Optional } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProjectService, NewProjectData, Project } from '../../../../core/project.service';
import { AuthService } from '../../../../core/auth.service';
import { User } from '@angular/fire/auth';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Timestamp } from '@angular/fire/firestore';
import { UserService } from '../../../../core/user.service';
import { Observable } from 'rxjs';
import { User as AppUser } from '../../../../core/models/user.model';
import { MatSelectModule } from '@angular/material/select';

export interface ProjectDialogData {
  project?: Project | null;
}

function endDateAfterOrEqualStartDateValidator(group: FormGroup) {
  const start = group.get('startDate')?.value;
  const end = group.get('endDate')?.value;
  if (start && end && new Date(end) < new Date(start)) {
    return { endDateBeforeStartDate: true };
  }
  return null;
}

function toDateInputValue(date: Date | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  const month = ('0' + (d.getMonth() + 1)).slice(-2);
  const day = ('0' + d.getDate()).slice(-2);
  return `${d.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-project-create',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule
  ],
  templateUrl: './project-create.component.html',
  styleUrls: ['./project-create.component.scss']
})
export class ProjectCreateComponent implements OnInit {
  projectForm: FormGroup;
  isLoading = false;
  currentUser: User | null = null;
  isEditMode = false;
  dialogTitle = '新規プロジェクトを作成';
  submitButtonText = '作成する';
  private editingProjectId: string | null = null;
  users$: Observable<AppUser[]>;

  private fb: FormBuilder = inject(FormBuilder);
  private projectService: ProjectService = inject(ProjectService);
  private authService: AuthService = inject(AuthService);
  private router: Router = inject(Router);
  private userService: UserService = inject(UserService);

  constructor(
    @Optional() public dialogRef?: MatDialogRef<ProjectCreateComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data?: ProjectDialogData
  ) {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      startDate: [null, Validators.required],
      endDate: [null, Validators.required],
      members: [[]],
      managerIds: [[]]
    }, { validators: endDateAfterOrEqualStartDateValidator });

    this.users$ = this.userService.getUsers();

    if (this.data && this.data.project) {
      this.isEditMode = true;
      this.dialogTitle = 'プロジェクト編集';
      this.submitButtonText = '更新する';
      this.editingProjectId = this.data.project.id;
      this.projectForm.patchValue({
        name: this.data.project.name,
        description: this.data.project.description,
        startDate: toDateInputValue(
          this.data.project.startDate instanceof Timestamp
            ? this.data.project.startDate.toDate()
            : this.data.project.startDate
        ),
        endDate: toDateInputValue(
          this.data.project.endDate instanceof Timestamp
            ? this.data.project.endDate.toDate()
            : this.data.project.endDate
        ),
        members: this.data.project.members ?? [],
        managerIds: this.data.project.managerIds ?? []
      });
    }
  }

  ngOnInit(): void {
    if (!this.isEditMode) {
      this.authService.authState$.subscribe((user: User | null) => {
        this.currentUser = user;
      });
    }
  }

  get name() { return this.projectForm.get('name'); }
  get description() { return this.projectForm.get('description'); }
  get startDate() { return this.projectForm.get('startDate'); }
  get endDate() { return this.projectForm.get('endDate'); }

  async onSubmit(): Promise<void> {
    if (this.projectForm.invalid || (!this.isEditMode && !this.currentUser)) {
      this.projectForm.markAllAsTouched();
      if (!this.isEditMode && !this.currentUser) {
        console.error('ユーザーがログインしていません。');
      }
      return;
    }

    this.isLoading = true;
    const formValue = this.projectForm.value;

    if (this.isEditMode && this.editingProjectId) {
      const updatedProjectData: Partial<Project> = {
        name: formValue.name,
        description: formValue.description,
        startDate: formValue.startDate ? Timestamp.fromDate(new Date(formValue.startDate)) : null,
        endDate: formValue.endDate ? Timestamp.fromDate(new Date(formValue.endDate)) : null,
        members: formValue.members,
        managerIds: formValue.managerIds
      };
      try {
        await this.projectService.updateProject(this.editingProjectId, updatedProjectData);
        console.log(`プロジェクト (ID: ${this.editingProjectId}) が正常に更新されました。`);
        this.dialogRef?.close(updatedProjectData);
      } catch (error) {
        console.error('プロジェクト更新エラー:', error);
        this.dialogRef?.close();
      } finally {
        this.isLoading = false;
      }
    } else {
      if (!this.currentUser) {
        console.error('新規作成モードでユーザー情報が取得できませんでした。');
        this.isLoading = false;
        return;
      }
      const newProjectData: NewProjectData = {
        name: formValue.name,
        description: formValue.description,
        managerId: this.currentUser.uid,
        status: 'active',
        startDate: formValue.startDate ? Timestamp.fromDate(new Date(formValue.startDate)) : null,
        endDate: formValue.endDate ? Timestamp.fromDate(new Date(formValue.endDate)) : null,
        members: formValue.members,
        managerIds: formValue.managerIds
      };
      try {
        const docRef = await this.projectService.createProject(newProjectData);
        console.log('プロジェクトが正常に作成されました。ID:', docRef.id);
        this.dialogRef?.close({ id: docRef.id, ...newProjectData });
      } catch (error) {
        console.error('プロジェクト作成エラー:', error);
        this.dialogRef?.close();
      } finally {
        this.isLoading = false;
      }
    }
  }

  onCancel(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    } else {
      this.router.navigate(['/app/dashboard']);
    }
  }
}
