import { 
  Component, 
  OnInit, 
  inject, 
//  Input, 
  Inject
 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { 
  TaskService,
  // Task,
  DailyLog,
  NewDailyLogData,
  PhotoEntry,
} from '../../../core/task.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Timestamp } from '@angular/fire/firestore';
import { MatIconModule } from '@angular/material/icon';
import { StorageService } from '../../../core/storage.service';
import { Observable, BehaviorSubject } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';

export interface DailyLogData {
  taskId: string;
  initialData?: DailyLog | null;
}

@Component({
  selector: 'app-daily-log-form',
  standalone: true,
  imports:[
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    // MatDialogModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  templateUrl:'./daily-log-form.component.html',
  styleUrls: ['./daily-log-form.component.scss'],
})

export class DailyLogFormComponent implements OnInit {
  dailyLogForm!: FormGroup;
  formError: string | null = null;
  isLoading = false;

  private taskService = inject(TaskService);
  private taskId!: string;
  private initialData: DailyLog | null = null;
  isEditMode = false;

  private storageService = inject(StorageService);
  selectedFileName: string | null = null;
  private progressSubject = new BehaviorSubject<number | undefined>(undefined);

  uploadProgress$ : Observable<number | undefined> = this.progressSubject.asObservable();

  uploadPhotoUrl: string | null = null;
  
  uploadedPhotos: PhotoEntry[] = [];

  // @Input() taskId!: string;

  constructor(
    private dialogRef: MatDialogRef<DailyLogFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DailyLogData
  ) { 
    if(data?.taskId) {
      this.taskId = data.taskId;
    }
    if(data?.initialData) {
      this.initialData = data.initialData;
      this.isEditMode = true;
    }
  }

  ngOnInit(): void {
    this.dailyLogForm = new FormGroup({
      'workDate': new FormControl<Timestamp | null>(null, [Validators.required]),
      'actualStartTime': new FormControl('', [Validators.required]),
      'actualEndTime': new FormControl('', [Validators.required]),
      'actualBreakTime': new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
      'progressRate': new FormControl<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
      'workerCount': new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
      'supervisor': new FormControl('', [Validators.required]),
      'comment': new FormControl(''),
    });

    if(this.isEditMode && this.initialData) {
      const formData = {
        ...this.initialData,
        workDate: this.initialData.workDate?.toDate() ?? null,
        actualStartTime: this.timestampToTimeString(this.initialData.actualStartTime),
        actualEndTime: this.timestampToTimeString(this.initialData.actualEndTime),
      }

      this.dailyLogForm.patchValue(formData);
      console.log('編集モード: フォームに初期値を設定しました', formData);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.dailyLogForm.invalid || !this.taskId) {
      this.dailyLogForm.markAllAsTouched();
      console.error('Form is invalid or taskId is missing');
      this.formError = '入力内容に誤りがあるか、タスクIDが指定されていません。';
      return;
    }

    this.isLoading = true;
    this.formError = null;

    const formValue = this.dailyLogForm.value;
    const workDate = formValue.workDate instanceof Date ? formValue.workDate : (formValue.workDate ?.toDate ? formValue.workDate.toDate() : new Date());

    let photosToSave: PhotoEntry[] | undefined = undefined;
    if(this.uploadedPhotos.length > 0) {
      photosToSave = this.uploadedPhotos;
    } else if (this.isEditMode && this.initialData?.photos && this.initialData.photos.length > 0) {
      photosToSave = this.initialData.photos;
    }


    const logData : NewDailyLogData = {
      workDate: Timestamp.fromDate(workDate),
      reporterId: 'TODO: Get current user ID',
      actualStartTime: formValue.actualStartTime ? this.timeStringToTimestamp(workDate, formValue.actualStartTime) : null,
      actualEndTime: formValue.actualEndTime ? this.timeStringToTimestamp(workDate, formValue.actualEndTime) : null,
      actualBreakTime: formValue.actualBreakTime,
      progressRate: formValue.progressRate,
      workerCount: formValue.workerCount,
      supervisor: formValue.supervisor,
      comment: formValue.comment,
      plannedStartTime: this.initialData?.plannedStartTime ?? null,
      plannedEndTime: this.initialData?.plannedEndTime ?? null,
      plannedBreakTime: this.initialData?.plannedBreakTime ?? null,
      photos: photosToSave ? photosToSave : [],

    };

    try { 
      if(this.isEditMode && this.initialData?.id) {
        await this.taskService.updateDailyLog(this.taskId, this.initialData.id, logData);
        console.log('日次ログ更新成功: Log ID:', this.initialData.id);
        this.dialogRef.close('saved');
      } else {
        const docRef = await this.taskService.addDailyLog(this.taskId, logData);
        console.log('日次ログ保存成功: Document written with ID:', docRef.id);
        this.dialogRef.close('created');
      }

    } catch (error: unknown) {
      console.error('日次ログ保存失敗: ', error);
      let errorMessage = '日次ログの保存/更新に失敗しました。時間をおいて再度お試しください。';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      this.formError = errorMessage;
    }finally {
      this.isLoading = false;
    }
  }

    private timeStringToTimestamp(workDate: Date, timeString: string): Timestamp | null {
      if(!timeString || !timeString.includes(':')) {
        console.error('不正確な時刻フォーマットです:', timeString);
        return null;
      }
      try {
        const [hours, minutes] = timeString.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59 ){
          console.error('時刻の数値が無効です:', hours, minutes);
          return null;
        }
        const dateWithTime = new Date(workDate);
        dateWithTime.setHours(hours, minutes, 0, 0);
        return Timestamp.fromDate(dateWithTime);
      } catch (error) {
        console.error('時刻からTimestampへの変換中にエラー:', error);
        return null;
      }
    }

    private timestampToTimeString(timestamp: Timestamp | null | undefined): string {
      if (!timestamp) {
        return '';
      }
      try {
        const date = timestamp.toDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      } catch (error) {
        console.error('Timestampから時刻文字列へ変換中にエラー:', error);
        return '';
      }
    }

    onFileSelect(event: Event, isFormCamera?: boolean): void {
      const element = event.currentTarget as HTMLInputElement;
      const fileList : FileList | null = element.files;

      console.log(`onFileSelect called. isFormCamera: ${!!isFormCamera}`);

      if (fileList && fileList.length > 0) {
        

        console.log(`${fileList.length}個のファイルが選択されました。`);
        for (const file of Array.from(fileList)) {
          console.log('Processing file:', file.name);
          this.startUpload(file, !!isFormCamera);
        }
        element.value = '';

      } else {
        console.log('ファイル選択がキャンセルされました、またファイルがありません。');
      }
    }

    private startUpload(file: File, isFormCamera?: boolean): void {
      if (!this.taskId) {
        console.error('Task ID is missing, cannot upload file');
        // alert('エラー:タスクIDがないためファイルをアップロードできません。');
        // this.selectedFileName = null;
        this.progressSubject.next(undefined);
        return;
      }
      const photoId = crypto.randomUUID();
      const safeFileName = encodeURIComponent(file.name);
      const filePath = `task_photos/${this.taskId}/${photoId}/${safeFileName}`;

      console.log(`Uploading file to: ${file.name} to: ${filePath}`);
      this.progressSubject.next(0);
      const uploadTask = this.storageService.uploadFile(file, filePath);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          this.progressSubject.next(progress);
          console.log(`Upload of ${file.name} is ${progress}% done`);
        },
        (error) => {
          console.error(`Upload filed for ${file.name}:`, error);
          this.progressSubject.next(undefined);
          // this.selectedFileName = null;
        }
      );

      uploadTask.then(
        async (snapshot) => {
          console.log(`Upload successful for ${file.name}!`, snapshot);
          // alert('ファイルアップロード成功');
          // this.selectedFileName = file.name + '(アップロード完了)';
          this.progressSubject.next(undefined);
          
          try {
            const downloadUrl = await this.storageService.getDownloadUrl(filePath);
            console.log(`Download URL for ${file.name}:`, downloadUrl);

            const newPhotoEntry: PhotoEntry = {
              id: photoId,
              url: downloadUrl,
              fileName: file.name,
              uploadedAt: Timestamp.now(),
              caption: '',
              wasTakenByCamera:!!isFormCamera
            };
            

            this.uploadedPhotos.push(newPhotoEntry);
            console.log('Updated uploadedPhotos:', this.uploadedPhotos);

          } catch (urlError) {
            console.error(`Filed to get download URL for ${file.name}:`, urlError);
            // alert('アップロードには成功しましたが、URLの取得に失敗しました。');
            // this.selectedFileName = file.name + '(URL取得失敗)';
            // this.uploadPhotoUrl = null;
          }
        },
        (error) => {
          console.error(`Upload failed for ${file.name} (Promise catch):`, error);
          this.progressSubject.next(undefined);
          // this.selectedFileName = null;
          // alert(`ファイルアップロード失敗: ${error.message || '不明なエラー'}`);
        }
      );
    }

    removePhoto(indexToRemove: number): void {
      if (indexToRemove >= 0 && indexToRemove < this.uploadedPhotos.length) {
        const removedPhoto = this.uploadedPhotos.splice(indexToRemove, 1);
        console.log('Removed photo:', removedPhoto[0]?.fileName, 'New list:', this.uploadedPhotos);
      }
    }

    onCancelClick(): void{
      console.log('キャンセル処理を開始します。');

      if (this.uploadedPhotos.length > 0) {
        console.log('添付済み(未保存)の写真情報があります。リストをクリアします。現在のリスト:', this.uploadedPhotos);
        this.uploadedPhotos = [];

      }
      this.dialogRef.close();
      console.log('日次作業ログ入力ダイアログがキャンセル操作により閉じられました。');
    }

    // console.log('Daily Log Form Submitted!', this.dailyLogForm.value);
  }


