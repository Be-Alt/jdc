import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { ProgramNetwork } from '../../../models/Program';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-settings-networks',
  imports: [AsyncPipe, ReactiveFormsModule],
  template: `
    <section class="mt-5 overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        (click)="toggleOpen()"
        class="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50"
      >
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Bloc paramètre</p>
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">Réseaux</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Ajoute, modifie et supprime les réseaux utilisés dans les programmes.
          </p>
        </div>

        <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-lg text-slate-700">
          {{ isOpen ? '−' : '+' }}
        </span>
      </button>

      @if (isOpen) {
        <div class="border-t border-slate-200 px-6 py-6">
          @if (vm$ | async; as vm) {
            @if (vm.errorMessage) {
              <div class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {{ vm.errorMessage }}
              </div>
            }

            @if (successMessage) {
              <div class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {{ successMessage }}
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-4 lg:grid-cols-[0.7fr_1.1fr_1.4fr_auto] lg:items-end">
              @if (editingNetworkId) {
                <div class="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 lg:col-span-4">
                  Modification en cours : <span class="font-semibold">{{ editingNetworkName }}</span>
                </div>
              }

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Code</span>
                <input
                  type="text"
                  formControlName="code"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 uppercase outline-none transition focus:border-sky-400"
                  placeholder="FWB"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">Nom</span>
                <input
                  type="text"
                  formControlName="name"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="Fédération Wallonie-Bruxelles"
                />
              </label>

              <label class="space-y-2">
                <span class="text-sm font-medium text-slate-800">URL</span>
                <input
                  type="text"
                  formControlName="url"
                  class="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  placeholder="https://..."
                />
              </label>

              <div class="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  [disabled]="form.invalid || isSubmitting"
                  class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {{
                    isSubmitting
                      ? (editingNetworkId ? 'Mise à jour...' : 'Ajout...')
                      : (editingNetworkId ? 'Enregistrer' : 'Ajouter')
                  }}
                </button>

                @if (editingNetworkId) {
                  <button
                    type="button"
                    (click)="resetForm()"
                    class="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                }
              </div>
            </form>

            <div class="mt-6">
              @if (vm.isLoading) {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (item of skeletonItems; track item) {
                    <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="h-5 w-20 animate-pulse rounded bg-slate-200"></div>
                      <div class="mt-3 h-4 w-36 animate-pulse rounded bg-slate-100"></div>
                    </div>
                  }
                </div>
              } @else if (vm.networks.length === 0) {
                <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  Aucun réseau enregistré pour le moment.
                </div>
              } @else {
                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (network of vm.networks; track network.id) {
                    <article class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <p class="text-lg font-semibold text-slate-950">{{ network.code }}</p>
                          <p class="mt-1 text-sm font-medium text-slate-700">{{ network.name }}</p>
                        </div>
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            (click)="editNetwork(network)"
                            class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            (click)="deleteNetwork(network)"
                            [disabled]="deletingNetworkId === network.id"
                            class="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {{ deletingNetworkId === network.id ? '...' : 'Supprimer' }}
                          </button>
                        </div>
                      </div>

                      @if (network.url) {
                        <a
                          [href]="network.url"
                          target="_blank"
                          rel="noreferrer noopener"
                          class="mt-3 block break-all text-sm text-sky-700 underline-offset-4 transition hover:text-sky-800 hover:underline"
                        >
                          {{ network.url }}
                        </a>
                      } @else {
                        <p class="mt-3 text-sm text-slate-500">URL non renseignée</p>
                      }
                    </article>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </section>
  `
})
export class SettingsNetworksComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly skeletonItems = [1, 2, 3];
  protected isOpen = false;
  protected isSubmitting = false;
  protected deletingNetworkId: string | null = null;
  protected successMessage = '';
  protected editingNetworkId: string | null = null;
  protected editingNetworkName = '';

  protected readonly form = this.formBuilder.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
    url: ['']
  });

  protected readonly vm$ = combineLatest([
    this.refreshSubject,
    this.errorMessageSubject.asObservable()
  ]).pipe(
    switchMap(([, errorMessage]) =>
      this.settingsService.getNetworks$().pipe(
        map((networks) => ({
          networks,
          isLoading: false,
          errorMessage
        })),
        startWith({
          networks: [] as ProgramNetwork[],
          isLoading: true,
          errorMessage
        }),
        catchError((error: unknown) =>
          of({
            networks: [] as ProgramNetwork[],
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les réseaux.'
          })
        )
      )
    )
  );

  protected toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    const rawValue = this.form.getRawValue();
    const payload = {
      code: rawValue.code?.trim().toUpperCase() || '',
      name: rawValue.name?.trim() || '',
      url: rawValue.url?.trim() || null
    };

    const request$ = this.editingNetworkId
      ? this.settingsService.updateNetwork$({
          networkId: this.editingNetworkId,
          ...payload
        })
      : this.settingsService.createNetwork$(payload);

    request$.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = this.editingNetworkId
          ? 'Le réseau a bien été mis à jour.'
          : 'Le réseau a bien été ajouté.';
        this.resetForm();
        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.isSubmitting = false;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’enregistrer le réseau.'
        );
      }
    });
  }

  protected editNetwork(network: ProgramNetwork): void {
    this.editingNetworkId = network.id;
    this.editingNetworkName = network.name;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.form.patchValue({
      code: network.code,
      name: network.name,
      url: network.url || ''
    });
  }

  protected resetForm(): void {
    this.editingNetworkId = null;
    this.editingNetworkName = '';
    this.form.reset({
      code: '',
      name: '',
      url: ''
    });
  }

  protected deleteNetwork(network: ProgramNetwork): void {
    if (this.deletingNetworkId || !confirm(`Supprimer le réseau "${network.code}" ?`)) {
      return;
    }

    this.deletingNetworkId = network.id;
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.settingsService.deleteNetwork$(network.id).subscribe({
      next: () => {
        this.deletingNetworkId = null;
        this.successMessage = 'Le réseau a bien été supprimé.';

        if (this.editingNetworkId === network.id) {
          this.resetForm();
        }

        this.refreshSubject.next();
      },
      error: (error: unknown) => {
        this.deletingNetworkId = null;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible de supprimer le réseau.'
        );
      }
    });
  }
}
