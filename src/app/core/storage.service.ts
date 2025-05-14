import { Injectable, inject } from '@angular/core';
import {
  Storage,
  ref,
  uploadBytesResumable,
  UploadTask,
  getDownloadURL,
  // StorageReference,
} from '@angular/fire/storage';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storage: Storage = inject(Storage);

  // constructor() { }

  uploadFile(file: File, path: string): UploadTask {
    if (!file || !path) {
      throw new Error('アップロードするファイルまたは保存パスが指定されていません。');
    }
    const storageRef = ref(this.storage, path);
    const uploadTask = uploadBytesResumable(storageRef, file);
    return uploadTask;
  }

  getDownloadUrl(path: string): Promise<string> {
    if (!path) {
      return Promise.reject(new Error('File path is required to get download URL.'));
    }
    const storageRef = ref(this.storage, path);
    return getDownloadURL(storageRef);
  }
}
