import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../core/components/header/header.component'; // HeaderComponent をインポート
import { NavigationComponent } from '../../core/components/navigation/navigation.component'; // NavigationComponent をインポート
import { CommonModule } from '@angular/common'; // CommonModule も念のため追加
@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [ 
    CommonModule, // 追加
    RouterOutlet,
    HeaderComponent,    // 追加
    NavigationComponent // 追加
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss'
})
export class AppLayoutComponent {

}
