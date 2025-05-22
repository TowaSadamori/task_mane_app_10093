import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-view-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div style="text-align:center; padding: 16px;">
      <img [src]="data.url" alt="拡大画像" style="max-width: 90vw; max-height: 80vh; border-radius: 8px;">
    </div>
  `
})
export class ImageViewDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ImageViewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { url: string }
  ) {}
} 