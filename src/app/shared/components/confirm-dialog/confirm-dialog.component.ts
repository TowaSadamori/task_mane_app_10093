import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  MatDialogModule,
  // MatDialogTitle,
  // MatDialogContent,
  // MatDialogActions,
  // MatDialogClose,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
  ],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent {

}
