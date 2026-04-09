import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-settings-program',
  imports: [RouterLink],
  template: `
    <section class="mt-5 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <div class="flex flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Bloc paramètre</p>
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Programme par section</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ouvre une vue dédiée, pensée pour mobile et tablette, avec filtre par section et par réseau.
          </p>
        </div>

        <a
          routerLink="/dashboard/settings/program"
          class="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Ouvrir le programme
        </a>
      </div>
    </section>
  `
})
export class SettingsProgramComponent {}
