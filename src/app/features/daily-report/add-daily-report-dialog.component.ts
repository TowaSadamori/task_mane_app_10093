import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
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

@Component({
  selector: 'app-add-daily-report-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatButtonModule, MatNativeDateModule, MatRadioModule, MatIconModule, MatSelectModule, MatOptionModule
  ],
  styleUrls: ['./add-daily-report-dialog.component.scss'],
  templateUrl: './add-daily-report-dialog.component.html',
})
export class AddDailyReportDialogComponent {
  form = new FormGroup({
    workDate: new FormControl<Date | null>(null, Validators.required),
    personUid: new FormControl('', Validators.required),
    managerUids: new FormControl<string[]>([], Validators.required),
    startTime: new FormControl('', Validators.required),
    endTime: new FormControl('', Validators.required),
    breakTime: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    hasReport: new FormControl('no', Validators.required),
    hasAccident: new FormControl('no', Validators.required),
    hasHealthIssue: new FormControl('no', Validators.required),
    memo: new FormControl(''),
  });
  userOptions: User[] = [];
  selectedPhotos: File[] = [];
  constructor(
    private dialogRef: MatDialogRef<AddDailyReportDialogComponent>,
    private storageService: StorageService,
    private userService: UserService,
    private authService: AuthService
  ) {
    this.userService.getUsers().subscribe(users => {
      this.userOptions = users;
    });
    this.setCurrentUserAsPerson();
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
  async onSubmit() {
    if (this.form.valid) {
      const photoUrls: string[] = [];
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
      this.dialogRef.close({ ...this.form.value, photoUrls });
    }
  }
}
