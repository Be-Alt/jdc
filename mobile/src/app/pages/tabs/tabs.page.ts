import { Component } from '@angular/core';
import {
  IonIcon,
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, peopleOutline, settingsOutline, todayOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  templateUrl: './tabs.page.html'
})
export class TabsPage {
  constructor() {
    addIcons({ todayOutline, peopleOutline, calendarOutline, settingsOutline });
  }
}
