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
import { StorageService } from '../../core/storage.service';

export interface EditDailyReportData {
  workDate: Date | string;
  person: string;
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
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatNativeDateModule, MatRadioModule, MatIconModule
  ],
  styleUrls: ['./edit-daily-report-dialog.component.scss'],
  templateUrl: './edit-daily-report-dialog.component.html',
})
export class EditDailyReportDialogComponent {
  form: FormGroup;
  selectedPhotos: File[] = [];
  existingPhotoUrls: string[] = [];
  constructor(
    private dialogRef: MatDialogRef<EditDailyReportDialogComponent>,
    private storageService: StorageService,
    @Inject(MAT_DIALOG_DATA) public data: EditDailyReportData
  ) {
    this.form = new FormGroup({
      workDate: new FormControl(data.workDate ? new Date(data.workDate) : null, Validators.required),
      person: new FormControl(data.person, Validators.required),
      startTime: new FormControl(data.startTime, Validators.required),
      endTime: new FormControl(data.endTime, Validators.required),
      breakTime: new FormControl<number | null>(data.breakTime, [Validators.required, Validators.min(0)]),
      hasReport: new FormControl(data.hasReport, Validators.required),
      hasAccident: new FormControl(data.hasAccident, Validators.required),
      hasHealthIssue: new FormControl(data.hasHealthIssue, Validators.required),
      memo: new FormControl(data.memo),
    });
    this.existingPhotoUrls = data.photoUrls ? [...data.photoUrls] : [];
  }
  onCancel() { this.dialogRef.close(); }
  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedPhotos = input.files ? Array.from(input.files) : [];
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