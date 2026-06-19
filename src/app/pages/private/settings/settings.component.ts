import { Component, inject } from '@angular/core';
import { SettingsDysComponent } from './settings-dys.component';
import { SettingsNetworksComponent } from './settings-networks.component';
import { SettingsProgramComponent } from './settings-program.component';
import { SettingsSchoolHolidaysComponent } from './settings-school-holidays.component';
import { SettingsSchoolsComponent } from './settings-schools.component';
import { SettingsSectionsComponent } from './settings-sections.component';
import { SettingsSubjectsComponent } from './settings-subjects.component';
import { SettingsTeachersComponent } from './settings-teachers.component';
import { SettingsWeeklyScheduleComponent } from './settings-weekly-schedule.component';
import { CurrentUserService } from '../../../services/current-user.service';

@Component({
  selector: 'app-settings',
  imports: [
    SettingsWeeklyScheduleComponent,
    SettingsNetworksComponent,
    SettingsDysComponent,
    SettingsSchoolsComponent,
    SettingsSectionsComponent,
    SettingsSubjectsComponent,
    SettingsTeachersComponent,
    SettingsProgramComponent,
    SettingsSchoolHolidaysComponent
  ],
  template: `
    <section class="space-y-6">
      <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Paramètres</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Configuration de l’application</h2>
          <p class="mt-3 max-w-4xl text-base leading-7 text-slate-600">
            Gère ici les réglages de ton espace, comme l’agenda hebdomadaire, les écoles d’origine, les professeurs et
            les référentiels utiles à tes fiches élèves.
          </p>
        </div>
      </div>

      @if (currentUserService.has('schedules.manage')) {
        <app-settings-weekly-schedule />
      }
      @if (currentUserService.has('directory.manage')) {
        <app-settings-school-holidays />
        <app-settings-dys />
        <app-settings-schools />
        <app-settings-teachers />
      }
      @if (currentUserService.has('programs.manage')) {
        <app-settings-networks />
        <app-settings-sections />
        <app-settings-subjects />
        <app-settings-program />
      }
    </section>
  `
})
export class SettingsComponent {
  protected readonly currentUserService = inject(CurrentUserService);
}
