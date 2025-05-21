import {
  Component,
  OnInit,
  inject,
//  Input,
  Inject,
  Optional
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
  DailyLog,
  NewDailyLogData,
  PhotoEntry,
  Task // ★ Task インターフェースをインポート
} from '../../../core/task.service';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Timestamp, serverTimestamp } from '@angular/fire/firestore'; // ★ serverTimestamp をインポート
import { MatIconModule } from '@angular/material/icon';
import { StorageService } from '../../../core/storage.service';
import { Observable, BehaviorSubject, firstValueFrom, of } from 'rxjs'; // ★ firstValueFrom, of をインポート
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { catchError } from 'rxjs/operators'; // ★ catchError をインポート
import { ActivatedRoute } from '@angular/router';

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

  projectId: string | null = null; // 戻るボタン用

  private storageService = inject(StorageService);
  selectedFileName: string | null = null;
  private progressSubject = new BehaviorSubject<number | undefined>(undefined);
  uploadProgress$ : Observable<number | undefined> = this.progressSubject.asObservable();
  uploadPhotoUrl: string | null = null;
  uploadedPhotos: PhotoEntry[] = [];

  constructor(
    @Optional() private dialogRef: MatDialogRef<DailyLogFormComponent>,
    @Optional() @Inject(MAT_DIALOG_DATA) public data: DailyLogData,
    private route: ActivatedRoute
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
    // ルーティング経由の場合はparamMapからtaskIdを取得
    if (!this.taskId) {
      this.route.paramMap.subscribe(params => {
        const tid = params.get('taskId');
        if (tid) {
          this.taskId = tid;
        }
      });
    }

    // taskIdがセットされたらTask情報を取得しprojectIdをセット
    if (this.taskId) {
      this.taskService.getTask(this.taskId).subscribe(task => {
        if (task && task.projectId) {
          this.projectId = task.projectId;
        }
      });
    }

    this.dailyLogForm = new FormGroup({
      'workDate': new FormControl<Date | null>(null, [Validators.required]), // ★ 型を Date | null に変更 (MatDatepickerはDateを返す)
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
      };
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
    // workDate はフォームから Date オブジェクトとして取得できるはず
    const workDate = formValue.workDate instanceof Date ? formValue.workDate : new Date();


    let photosToSave: PhotoEntry[] | undefined = undefined;
    if(this.uploadedPhotos.length > 0) {
      photosToSave = this.uploadedPhotos;
    } else if (this.isEditMode && this.initialData?.photos && this.initialData.photos.length > 0) {
      photosToSave = this.initialData.photos;
    }

    const logData : NewDailyLogData = {
      workDate: Timestamp.fromDate(workDate), // DateからTimestampに変換
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
      // --- Taskの進捗とステータス更新 ---
      const progressToUpdate = formValue.progressRate;
      if (typeof progressToUpdate === 'number' && progressToUpdate >= 0 && progressToUpdate <= 100) {
        let newStatus: 'todo' | 'doing' | 'done' = 'todo';
        if (progressToUpdate > 0 && progressToUpdate < 100) {
          newStatus = 'doing';
        } else if (progressToUpdate === 100) {
          newStatus = 'done';
        }
        try {
          await this.taskService.updateTaskProgressAndStatus(this.taskId, progressToUpdate, newStatus);
          console.log(`Task ID: ${this.taskId} の進捗を ${progressToUpdate}%、ステータスを「${newStatus}」に更新しました。`);
        } catch (taskUpdateError) {
          console.error(`Task ID: ${this.taskId} の進捗およびステータス更新に失敗しました。`, taskUpdateError);
          this.formError = 'タスク本体の進捗・ステータス更新に失敗しましたが、日次ログの保存は試みます。';
        }
      } else {
        console.warn(`Task ID: ${this.taskId} の進捗更新はスキップされました。progressRateが不正です:`, progressToUpdate);
      }

      // --- 日次ログ自体の保存処理 ---
      if(this.isEditMode && this.initialData?.id) {
        await this.taskService.updateDailyLog(this.taskId, this.initialData.id, logData);
        console.log('日次ログ更新成功: Log ID:', this.initialData.id);
      } else {
        const docRef = await this.taskService.addDailyLog(this.taskId, logData);
        console.log('日次ログ保存成功: Document written with ID:', docRef.id);
      }

      // ▼▼▼ 実績開始日・終了日の更新ロジック (ここから挿入) ▼▼▼
      try {
        const allLogsObservable = this.taskService.getDailyLogs(this.taskId);
        const allLogs = await firstValueFrom(allLogsObservable.pipe(catchError(err => {
          console.error('実績日更新のための日次ログ取得エラー:', err);
          return of([]);
        })));

        let taskUpdateNeeded = false;
        const taskUpdateData: Partial<Task> = {};

        if (allLogs && allLogs.length > 0) {
          const sortedLogsByWorkDateAsc = [...allLogs].sort((a, b) =>
            (this.getMillis(a.workDate) ?? Infinity) - (this.getMillis(b.workDate) ?? Infinity)
          );
          const earliestLog = sortedLogsByWorkDateAsc[0];

          if (earliestLog && earliestLog.workDate) {
            const newActualStartDate = earliestLog.workDate; // This is a Timestamp

            const currentTask = await firstValueFrom(this.taskService.getTask(this.taskId).pipe(catchError(() => of(undefined))));
            if (currentTask) { // currentTask が undefined でないことを確認
                if (!currentTask.actualStartDate ||
                    (currentTask.actualStartDate instanceof Timestamp && // 型ガードを追加
                     this.getMillis(newActualStartDate) !== undefined &&
                     this.getMillis(currentTask.actualStartDate) !== undefined &&
                     this.getMillis(newActualStartDate)! < this.getMillis(currentTask.actualStartDate)!)) {
                  taskUpdateData.actualStartDate = newActualStartDate;
                  taskUpdateNeeded = true;
                }
            } else { // currentTask が見つからない場合 (通常はありえないが念のため)
                 taskUpdateData.actualStartDate = newActualStartDate; // 新規タスクで初めてログを付ける場合など
                 taskUpdateNeeded = true;
            }
          }

          const currentTaskForEndDate = await firstValueFrom(this.taskService.getTask(this.taskId).pipe(catchError(() => of(undefined))));
          if (currentTaskForEndDate && currentTaskForEndDate.status === 'done') {
            const latestLogForEndDate = sortedLogsByWorkDateAsc[sortedLogsByWorkDateAsc.length - 1];
            if (latestLogForEndDate && latestLogForEndDate.workDate) {
              const newActualEndDate = latestLogForEndDate.workDate; // This is a Timestamp
              if (!currentTaskForEndDate.actualEndDate ||
                  (currentTaskForEndDate.actualEndDate instanceof Timestamp && // 型ガードを追加
                   this.getMillis(newActualEndDate) !== undefined &&
                   this.getMillis(currentTaskForEndDate.actualEndDate) !== undefined &&
                   this.getMillis(newActualEndDate)! > this.getMillis(currentTaskForEndDate.actualEndDate)!)) {
                taskUpdateData.actualEndDate = newActualEndDate;
                taskUpdateNeeded = true;
              }
            }
          }
        }

        if (taskUpdateNeeded) {
          taskUpdateData.updatedAt = serverTimestamp();
          await this.taskService.updateTask(this.taskId, taskUpdateData);
          console.log(`Task ID: ${this.taskId} の実績日が更新されました。`, taskUpdateData);
        }
      } catch (dateUpdateError) {
        console.error(`Task ID: ${this.taskId} の実績日更新中にエラーが発生しました。`, dateUpdateError);
      }
      // ▲▲▲ 実績開始日・終了日の更新ロジックここまで ▲▲▲

      // ダイアログを閉じる処理
      if(this.isEditMode) {
        this.dialogRef.close('saved');
      } else {
        this.dialogRef.close('created');
      }

    } catch (error: unknown) {
      console.error('日次ログ保存またはTask更新全体でエラー: ', error);
      let errorMessage = '処理中にエラーが発生しました。';
      if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
        errorMessage = error.message;
      }
      this.formError = errorMessage;
    } finally {
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
      }
    );

    uploadTask.then(
      async (snapshot) => {
        console.log(`Upload successful for ${file.name}!`, snapshot);
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
        }
      },
      (error) => {
        console.error(`Upload failed for ${file.name} (Promise catch):`, error);
        this.progressSubject.next(undefined);
      }
    );
  }

  removePhoto(indexToRemove: number): void {
    if (indexToRemove >= 0 && indexToRemove < this.uploadedPhotos.length) {
      const removedPhoto = this.uploadedPhotos.splice(indexToRemove, 1);
      console.log('Removed photo:', removedPhoto[0]?.fileName, 'New list:', this.uploadedPhotos);
    }
  }

  async onCancelClick(): Promise<void> {
    console.log('キャンセル処理を開始します。');
    if (this.uploadedPhotos.length > 0) {
      console.log('添付済み(未保存)の写真情報があります。リストをクリアします。現在のリスト:', this.uploadedPhotos);
      this.uploadedPhotos = [];
    }
    // ★★★ onCancelClick から実績日更新ロジックを削除 ★★★
    // 実績日の更新は onSubmit で日次ログが実際に保存されたときのみ行うのが自然
    this.dialogRef.close();
    console.log('日次作業ログ入力ダイアログがキャンセル操作により閉じられました。');
  }

  private getMillis(dt: Timestamp | Date | null | undefined): number | undefined {
    if (dt instanceof Timestamp) return dt.toMillis();
    if (dt instanceof Date) return dt.getTime();
    return undefined;
  }

  navigateToGanttChart(): void {
    if (this.projectId) {
      // /app/gantt-chart/:projectId へ遷移
      window.location.href = `/app/gantt-chart/${this.projectId}`;
    } else {
      // projectIdが取得できなければガントチャート一覧へ
      window.location.href = '/app/gantt-chart';
    }
  }
}