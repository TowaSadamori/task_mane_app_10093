import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { StorageService } from '../../core/storage.service';
import { UserService } from '../../core/user.service';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/auth.service';

export interface EditDailyReportData {
  workDate: Date | string;
  personUid: string;
  managerUids: string[];
  startTime: string;
  endTime: string;
  breakTime: number;
  hasReport: string;
  hasAccident: string;
  hasHealthIssue: string;
  memo: string;
  photoUrls?: string[];
  id?: string;
}

@Component({
  selector: 'app-edit-daily-report-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatNativeDateModule, MatRadioModule, MatIconModule, MatSelectModule, MatOptionModule
  ],
  styleUrls: ['./edit-daily-report-dialog.component.scss'],
  templateUrl: './edit-daily-report-dialog.component.html',
})
export class EditDailyReportDialogComponent {
  form: FormGroup;
  userOptions: User[] = [];
  selectedPhotos: File[] = [];
  existingPhotoUrls: string[] = [];
  constructor(
    private dialogRef: MatDialogRef<EditDailyReportDialogComponent>,
    private storageService: StorageService,
    private userService: UserService,
    private authService: AuthService,
    @Inject(MAT_DIALOG_DATA) public data: EditDailyReportData
  ) {
    this.form = new FormGroup({
      workDate: new FormControl(data.workDate ? new Date(data.workDate) : null, Validators.required),
      personUid: new FormControl(data.personUid, Validators.required),
      managerUids: new FormControl(data.managerUids || [], Validators.required),
      startTime: new FormControl(data.startTime, Validators.required),
      endTime: new FormControl(data.endTime, Validators.required),
      breakTime: new FormControl<number | null>(data.breakTime, [Validators.required, Validators.min(0)]),
      hasReport: new FormControl(data.hasReport, Validators.required),
      hasAccident: new FormControl(data.hasAccident, Validators.required),
      hasHealthIssue: new FormControl(data.hasHealthIssue, Validators.required),
      memo: new FormControl(data.memo),
    });
    this.existingPhotoUrls = data.photoUrls ? [...data.photoUrls] : [];
    this.userService.getUsers().subscribe(users => {
      this.userOptions = users;
    });
    if (!data.personUid) {
      this.setCurrentUserAsPerson();
    }
  }
  async setCurrentUserAsPerson() {
    const user = await this.authService.getCurrentUser();
    if (user && user.uid) {
      this.form.get('personUid')?.setValue(user.uid);
    }
  }
  onCancel() { this.dialogRef.close(); }
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.selectedPhotos = this.selectedPhotos.concat(files);
  }
  removePhoto(index: number, photoInput: HTMLInputElement) {
    this.selectedPhotos.splice(index, 1);
    photoInput.value = '';
  }
  removeExistingPhoto(index: number) {
    this.existingPhotoUrls.splice(index, 1);
  }
  async onSubmit() {
    if (this.form.valid) {
      const photoUrls: string[] = [...this.existingPhotoUrls];
      for (const file of this.selectedPhotos) {
        const path = `dailyReports/${Date.now()}_${file.name}`;
        const uploadTask = this.storageService.uploadFile(file, path);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            undefined,
            error => reject(error),
            async () => {
              const url = await this.storageService.getDownloadUrl(path);
              photoUrls.push(url);
              resolve();
            }
          );
        });
      }
      this.dialogRef.close({ ...this.form.value, photoUrls, id: this.data.id });
    }
  }
} 