import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { getDysIconConfig } from '../../../helpers/dys-icons';
import { BehaviorSubject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { DysType } from '../../../models/DysType';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-settings-dys',
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
          <h3 class="mt-2 text-2xl font-semibold text-slate-950">DYS et aménagements</h3>
          <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Retouche ici les types de troubles DYS et les aménagements proposés aux élèves.
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

            @if (vm.isLoading) {
              <div class="grid gap-4 lg:grid-cols-2">
                @for (item of skeletonItems; track item) {
                  <div class="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                    <div class="h-5 w-24 animate-pulse rounded bg-slate-200"></div>
                    <div class="mt-4 h-4 w-40 animate-pulse rounded bg-slate-100"></div>
                    <div class="mt-6 h-20 animate-pulse rounded-2xl bg-white"></div>
                  </div>
                }
              </div>
            } @else {
              <div class="space-y-4">
                @for (group of dysForms.controls; track trackDysGroup(group, $index); let index = $index) {
                  <form
                    [formGroup]="asFormGroup(group)"
                    (ngSubmit)="saveDys(index)"
                    class="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5"
                  >
                    <div class="mb-4 flex items-center gap-3">
                      <span
                        class="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold"
                        [class]="getDysIconClasses(group)"
                      >
                        {{ getDysIconLabel(group) }}
                      </span>
                      <div>
                        <p class="text-sm font-medium tracking-[0.18em] text-slate-500 uppercase">Type DYS</p>
                        <p class="text-base font-semibold text-slate-950">{{ asFormGroup(group).get('nom')?.value }}</p>
                      </div>
                    </div>

                    <div class="grid gap-4 xl:grid-cols-[180px_1fr]">
                      <label class="space-y-2">
                        <span class="text-sm font-medium text-slate-800">Code</span>
                        <input
                          type="text"
                          formControlName="code"
                          class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </label>

                      <label class="space-y-2">
                        <span class="text-sm font-medium text-slate-800">Nom</span>
                        <input
                          type="text"
                          formControlName="nom"
                          class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        />
                      </label>
                    </div>

                    <label class="mt-4 block space-y-2">
                      <span class="text-sm font-medium text-slate-800">Description</span>
                      <textarea
                        rows="3"
                        formControlName="description"
                        class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                      ></textarea>
                    </label>

                    <div class="mt-5">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <p class="text-sm font-medium text-slate-800">Aménagements</p>
                          <p class="mt-1 text-sm text-slate-500">Ajoute, retire ou modifie les aides proposées.</p>
                        </div>

                        <button
                          type="button"
                          (click)="addAccommodation(index)"
                          class="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
                        >
                          Ajouter
                        </button>
                      </div>

                      <div class="mt-4 space-y-3">
                        @for (accommodationControl of getAccommodationControls(index); track $index; let accIndex = $index) {
                          <div class="flex items-start gap-3">
                            <input
                              type="text"
                              [formControl]="asFormControl(accommodationControl)"
                              class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                              placeholder="Aménagement"
                            />
                            <button
                              type="button"
                              (click)="removeAccommodation(index, accIndex)"
                              class="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                            >
                              Supprimer
                            </button>
                          </div>
                        }
                      </div>
                    </div>

                    <div class="mt-5 flex flex-wrap justify-end gap-3">
                      <button
                        type="submit"
                        [disabled]="asFormGroup(group).invalid || savingDysId === asFormGroup(group).get('id')?.value"
                        class="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {{
                          savingDysId === asFormGroup(group).get('id')?.value
                            ? 'Enregistrement...'
                            : 'Enregistrer'
                        }}
                      </button>
                    </div>
                  </form>
                }
              </div>
            }
          }
        </div>
      }
    </section>
  `
})
export class SettingsDysComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly errorMessageSubject = new BehaviorSubject<string>('');

  protected readonly skeletonItems = [1, 2, 3];
  protected isOpen = false;
  protected successMessage = '';
  protected savingDysId: number | null = null;

  protected readonly dysForms = this.formBuilder.array<FormGroup>([]);

  protected readonly vm$ = combineLatest([
    this.refreshSubject,
    this.errorMessageSubject.asObservable()
  ]).pipe(
    switchMap(([, errorMessage]) =>
      this.settingsService.getDysTypes$().pipe(
        map((dysTypes) => {
          this.patchForms(dysTypes);
          return {
            isLoading: false,
            errorMessage
          };
        }),
        startWith({
          isLoading: true,
          errorMessage
        }),
        catchError((error: unknown) =>
          of({
            isLoading: false,
            errorMessage: error instanceof Error ? error.message : 'Impossible de charger les DYS.'
          })
        )
      )
    )
  );

  protected toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  protected asFormGroup(control: unknown): FormGroup {
    return control as FormGroup;
  }

  protected asFormControl(control: unknown): FormControl {
    return control as FormControl;
  }

  protected getDysIconConfig(value: string) {
    return getDysIconConfig(value);
  }

  protected getDysIconClasses(group: unknown): string {
    const code = String((group as FormGroup).get('code')?.value ?? '');
    const iconConfig = getDysIconConfig(code);
    return `${iconConfig.bgClass} ${iconConfig.textClass}`;
  }

  protected getDysIconLabel(group: unknown): string {
    const code = String((group as FormGroup).get('code')?.value ?? '');
    return getDysIconConfig(code).icon;
  }

  protected trackDysGroup(group: unknown, index: number): string {
    const formGroup = group as FormGroup;
    return `${formGroup.get('id')?.value}-${index}`;
  }

  protected getAccommodationControls(index: number) {
    return (this.dysForms.at(index).get('accommodations') as FormArray).controls;
  }

  protected addAccommodation(index: number): void {
    (this.dysForms.at(index).get('accommodations') as FormArray).push(
      this.formBuilder.control('', Validators.required)
    );
  }

  protected removeAccommodation(index: number, accommodationIndex: number): void {
    (this.dysForms.at(index).get('accommodations') as FormArray).removeAt(accommodationIndex);
  }

  protected saveDys(index: number): void {
    const formGroup = this.dysForms.at(index);

    if (formGroup.invalid || this.savingDysId !== null) {
      formGroup.markAllAsTouched();
      return;
    }

    const rawValue = formGroup.getRawValue();
    this.savingDysId = Number(rawValue.id);
    this.successMessage = '';
    this.errorMessageSubject.next('');

    this.settingsService.updateDysType$({
      id: Number(rawValue.id),
      code: String(rawValue.code ?? '').trim(),
      nom: String(rawValue.nom ?? '').trim(),
      description: String(rawValue.description ?? '').trim() || null,
      accommodations: ((rawValue.accommodations ?? []) as string[])
        .map((item) => item.trim())
        .filter(Boolean)
    }).subscribe({
      next: (updatedDys) => {
        this.savingDysId = null;
        this.successMessage = `${updatedDys.nom} a bien été mis à jour.`;
        this.replaceFormAt(index, updatedDys);
      },
      error: (error: unknown) => {
        this.savingDysId = null;
        this.errorMessageSubject.next(
          error instanceof Error ? error.message : 'Impossible d’enregistrer le DYS.'
        );
      }
    });
  }

  private patchForms(dysTypes: DysType[]): void {
    this.dysForms.clear();

    for (const dysType of dysTypes) {
      this.dysForms.push(this.createDysForm(dysType));
    }
  }

  private replaceFormAt(index: number, dysType: DysType): void {
    this.dysForms.setControl(index, this.createDysForm(dysType));
  }

  private createDysForm(dysType: DysType): FormGroup {
    return this.formBuilder.group({
      id: [dysType.id, Validators.required],
      code: [dysType.code, Validators.required],
      nom: [dysType.nom, Validators.required],
      description: [dysType.description ?? ''],
      accommodations: this.formBuilder.array(
        (dysType.accommodations ?? []).map((item) =>
          this.formBuilder.control(item.amenagement, Validators.required)
        )
      )
    });
  }
}
