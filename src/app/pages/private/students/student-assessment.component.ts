import { NgClass } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ProgramUaa } from '../../../models/Program';
import { Student } from '../../../models/Student';
import {
  AssessmentItemType,
  AssessmentStatus,
  StudentSummary
} from '../../../models/StudentSummary';
import { StudentsService } from '../../../services/students.service';

type AssessmentValue = AssessmentStatus | '';
type AssessmentItem = {
  id: string;
  type: AssessmentItemType;
  description: string;
  category: string;
  worked: boolean;
};

type ProgramMaterial = {
  id: string;
  description: string;
  worked: boolean;
};

@Component({
  selector: 'app-student-assessment',
  imports: [FormsModule, NgClass],
  template: `
    <section class="mx-auto max-w-6xl space-y-6">
      <header class="flex flex-col gap-4 rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Bilan des compétences</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {{ student ? student.first_name + ' ' + student.last_name : 'Chargement...' }}
          </h2>
          @if (summary?.program; as program) {
            <p class="mt-2 text-sm text-slate-600">
              {{ program.program?.name || program.program?.subject?.name }} · {{ program.section?.code || 'Tous niveaux' }}
            </p>
          }
        </div>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            (click)="save()"
            [disabled]="isLoading || isSaving || !summary?.program"
            class="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ isSaving ? 'Enregistrement...' : 'Enregistrer le bilan' }}
          </button>
          <button
            type="button"
            (click)="exportDocument()"
            [disabled]="isLoading || !summary?.program"
            class="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exporter pour Google Docs
          </button>
          <button
            type="button"
            (click)="closeWindow()"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Fermer
          </button>
        </div>
      </header>

      @if (errorMessage) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {{ errorMessage }}
        </div>
      }
      @if (successMessage) {
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {{ successMessage }}
        </div>
      }

      @if (isLoading) {
        <div class="rounded-[1.8rem] border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
          Chargement du programme et du bilan...
        </div>
      } @else if (!summary?.program) {
        <div class="rounded-[1.8rem] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Aucun programme n’est attribué à cet élève. Le bilan ne peut pas encore être créé.
        </div>
      } @else {
        <section class="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div class="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <label class="block">
              <span class="text-sm font-medium text-slate-700">Rechercher une compétence</span>
              <input
                type="search"
                [(ngModel)]="searchTerm"
                placeholder="Mot-clé, UAA, processus..."
                class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label class="block">
              <span class="text-sm font-medium text-slate-700">Contenu de l’export</span>
              <select
                [(ngModel)]="exportMode"
                class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-500"
              >
                <option value="all">Toutes les compétences</option>
                <option value="positive">Uniquement en cours et acquises</option>
              </select>
            </label>
          </div>

          <div class="mt-5 flex flex-wrap gap-3 text-xs font-medium">
            <span class="rounded-full bg-sky-100 px-3 py-1.5 text-sky-800">Bleu : déjà travaillée dans le journal</span>
            <span class="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">{{ countStatus('acquired') }} acquise(s)</span>
            <span class="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">{{ countStatus('in_progress') }} en cours</span>
            <span class="rounded-full bg-rose-100 px-3 py-1.5 text-rose-800">{{ countStatus('not_acquired') }} non acquise(s)</span>
          </div>
        </section>

        <div class="space-y-5">
          @for (uaa of filteredUaas(); track uaa.id) {
            <article class="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
              <header class="border-b border-slate-200 bg-slate-100 px-5 py-4">
                <span class="text-xs font-semibold tracking-[0.16em] text-sky-700 uppercase">
                  {{ uaa.code }}
                </span>
                <span class="ml-3 text-sm font-semibold text-slate-950">{{ uaa.name }}</span>
              </header>

              @if (getFilteredItems(uaa).length > 0) {
                <div class="overflow-x-auto">
                  <table class="min-w-[760px] w-full border-collapse text-left">
                    <thead class="bg-slate-950 text-white">
                      <tr>
                        <th class="px-5 py-3 text-xs font-semibold uppercase">Compétence</th>
                        <th class="w-32 px-3 py-3 text-center text-xs font-semibold uppercase">Non acquis</th>
                        <th class="w-24 px-3 py-3 text-center text-xs font-semibold uppercase">ECA</th>
                        <th class="w-24 px-3 py-3 text-center text-xs font-semibold uppercase">A</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of getFilteredItems(uaa); track item.type + ':' + item.id) {
                        <tr
                          class="border-t border-slate-100 transition hover:bg-slate-50"
                          [ngClass]="item.worked ? 'bg-sky-50/80' : 'bg-white'"
                        >
                          <td class="px-5 py-4">
                            <div class="flex flex-wrap items-center gap-2">
                              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                {{ item.category }}
                              </span>
                              @if (item.worked) {
                                <span class="rounded-full bg-sky-200 px-2.5 py-1 text-[11px] font-semibold text-sky-900">
                                  Déjà travaillée
                                </span>
                              }
                            </div>
                            <p class="mt-2 text-sm leading-6 text-slate-800">{{ item.description }}</p>
                          </td>
                          <td class="bg-rose-50/60 px-3 py-4 text-center">
                            <input type="checkbox" [checked]="getStatus(item) === 'not_acquired'" (change)="toggleStatus(item, 'not_acquired')" class="h-6 w-6 cursor-pointer rounded border-rose-300 accent-rose-600" [attr.aria-label]="'Marquer non acquis : ' + item.description" />
                          </td>
                          <td class="bg-amber-50/60 px-3 py-4 text-center">
                            <input type="checkbox" [checked]="getStatus(item) === 'in_progress'" (change)="toggleStatus(item, 'in_progress')" class="h-6 w-6 cursor-pointer rounded border-amber-300 accent-amber-500" [attr.aria-label]="'Marquer en cours d’acquisition : ' + item.description" />
                          </td>
                          <td class="bg-emerald-50/60 px-3 py-4 text-center">
                            <input type="checkbox" [checked]="getStatus(item) === 'acquired'" (change)="toggleStatus(item, 'acquired')" class="h-6 w-6 cursor-pointer rounded border-emerald-300 accent-emerald-600" [attr.aria-label]="'Marquer acquis : ' + item.description" />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              @if (getFilteredMaterials(uaa).length > 0) {
                <div class="border-t border-slate-200">
                  <div class="bg-sky-100/70 px-5 py-3 text-xs font-semibold tracking-[0.14em] text-sky-900 uppercase">
                    Ressources
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-[620px] w-full border-collapse text-left">
                      <thead class="bg-sky-950 text-white">
                        <tr>
                          <th class="px-5 py-3 text-xs font-semibold uppercase">Ressource</th>
                          <th class="w-24 px-3 py-3 text-center text-xs font-semibold uppercase">Vue</th>
                          <th class="w-24 px-3 py-3 text-center text-xs font-semibold uppercase">Non vue</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (material of getFilteredMaterials(uaa); track material.id) {
                          <tr
                            class="border-t border-slate-100 transition hover:bg-slate-50"
                            [ngClass]="material.worked ? 'bg-sky-50/80' : 'bg-white'"
                          >
                            <td class="px-5 py-4">
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">Ressource</span>
                                @if (material.worked) {
                                  <span class="rounded-full bg-sky-200 px-2.5 py-1 text-[11px] font-semibold text-sky-900">Déjà abordée</span>
                                }
                              </div>
                              <p class="mt-2 text-sm leading-6 text-slate-800">{{ material.description }}</p>
                            </td>
                            <td class="bg-emerald-50/60 px-3 py-4 text-center">
                              <input type="checkbox" [checked]="getMaterialStatus(material) === 'viewed'" (change)="toggleMaterialStatus(material, 'viewed')" class="h-6 w-6 cursor-pointer rounded border-emerald-300 accent-emerald-600" [attr.aria-label]="'Marquer vue : ' + material.description" />
                            </td>
                            <td class="bg-slate-100 px-3 py-4 text-center">
                              <input type="checkbox" [checked]="getMaterialStatus(material) === 'not_viewed'" (change)="toggleMaterialStatus(material, 'not_viewed')" class="h-6 w-6 cursor-pointer rounded border-slate-400 accent-slate-600" [attr.aria-label]="'Marquer non vue : ' + material.description" />
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }
            </article>
          } @empty {
            <div class="rounded-[1.8rem] border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-600 shadow-sm">
              Aucune compétence ou ressource ne correspond à la recherche.
            </div>
          }
        </div>
      }
    </section>
  `
})
export class StudentAssessmentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly studentsService = inject(StudentsService);

  protected student: Student | null = null;
  protected summary: StudentSummary | null = null;
  protected isLoading = true;
  protected isSaving = false;
  protected errorMessage = '';
  protected successMessage = '';
  protected searchTerm = '';
  protected exportMode: 'all' | 'positive' = 'all';
  private statuses: Record<string, AssessmentValue> = {};

  async ngOnInit(): Promise<void> {
    const enrollmentId = this.route.snapshot.paramMap.get('id');
    if (!enrollmentId) {
      this.errorMessage = 'Identifiant élève manquant.';
      this.isLoading = false;
      return;
    }

    try {
      const [student, summary] = await firstValueFrom(
        forkJoin([
          this.studentsService.getStudentByEnrollmentId$(enrollmentId),
          this.studentsService.getStudentSummary$(enrollmentId)
        ])
      );
      this.student = student;
      this.summary = summary;

      if (summary.program?.program?.id) {
        const assessments = await firstValueFrom(
          this.studentsService.getStudentAssessments$(enrollmentId, summary.program.program.id)
        );
        this.statuses = Object.fromEntries(
          assessments.map((item) => [`${item.item_type}:${item.item_id}`, item.status])
        );
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger le bilan.';
    } finally {
      this.isLoading = false;
    }
  }

  protected filteredUaas(): ProgramUaa[] {
    return (this.summary?.program?.uaas ?? []).filter(
      (uaa) => this.getFilteredItems(uaa).length > 0 || this.getFilteredMaterials(uaa).length > 0
    );
  }

  protected getFilteredItems(uaa: ProgramUaa): AssessmentItem[] {
    const workedSkillIds = this.summary?.workedSkillIds ?? [];
    const items: AssessmentItem[] = [
      ...uaa.competences.map((item) => ({
        id: item.id,
        type: 'competence' as const,
        description: item.description,
        category: 'Compétence à développer',
        worked: false
      })),
      ...uaa.skillGroups.flatMap((group) =>
        group.skills.map((skill) => ({
          id: skill.id,
          type: 'skill' as const,
          description: skill.description,
          category: group.processTypeName,
          worked: workedSkillIds.includes(skill.id)
        }))
      )
    ];
    const search = this.searchTerm.trim().toLocaleLowerCase('fr');
    if (!search) return items;
    return items.filter((item) =>
      `${uaa.code} ${uaa.name} ${item.category} ${item.description}`.toLocaleLowerCase('fr').includes(search)
    );
  }

  protected getStatus(item: AssessmentItem): AssessmentValue {
    return this.statuses[`${item.type}:${item.id}`] ?? '';
  }

  protected getFilteredMaterials(uaa: ProgramUaa): ProgramMaterial[] {
    const workedResourceIds = this.summary?.workedResourceIds ?? [];
    const materials = uaa.resources.map((resource) => ({
      id: resource.id,
      description: resource.description,
      worked: workedResourceIds.includes(resource.id)
    }));
    const search = this.searchTerm.trim().toLocaleLowerCase('fr');
    if (!search) return materials;
    return materials.filter((material) =>
      `${uaa.code} ${uaa.name} matière ressource ${material.description}`
        .toLocaleLowerCase('fr')
        .includes(search)
    );
  }

  protected toggleStatus(item: AssessmentItem, status: AssessmentStatus): void {
    const key = `${item.type}:${item.id}`;
    this.statuses = {
      ...this.statuses,
      [key]: this.statuses[key] === status ? '' : status
    };
    this.successMessage = '';
  }

  protected getMaterialStatus(material: ProgramMaterial): AssessmentValue {
    return this.statuses[`resource:${material.id}`] ?? '';
  }

  protected toggleMaterialStatus(
    material: ProgramMaterial,
    status: 'viewed' | 'not_viewed'
  ): void {
    const key = `resource:${material.id}`;
    this.statuses = {
      ...this.statuses,
      [key]: this.statuses[key] === status ? '' : status
    };
    this.successMessage = '';
  }

  protected countStatus(status: AssessmentStatus): number {
    return Object.values(this.statuses).filter((value) => value === status).length;
  }

  protected async save(): Promise<void> {
    const enrollmentId = this.student?.enrollment_id;
    const programId = this.summary?.program?.program?.id;
    if (!enrollmentId || !programId) return;

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const assessments = Object.entries(this.statuses)
        .filter((entry): entry is [string, AssessmentStatus] => entry[1] !== '')
        .map(([key, status]) => {
          const [itemType, itemId] = key.split(':');
          return { itemType: itemType as AssessmentItemType, itemId, status };
        });
      await firstValueFrom(
        this.studentsService.saveStudentAssessments$(enrollmentId, programId, assessments)
      );
      this.successMessage = 'Le bilan a bien été enregistré.';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible d’enregistrer le bilan.';
    } finally {
      this.isSaving = false;
    }
  }

  protected exportDocument(): void {
    if (!this.student || !this.summary?.program) return;
    const sections = this.summary.program.uaas
      .map((uaa) => {
        const rows = this.getFilteredItemsForExport(uaa)
          .map((item) => {
            const status = this.getStatus(item);
            return `<tr><td>${this.escapeHtml(item.description)}</td><td class="status">${status === 'in_progress' ? '✓' : ''}</td><td class="status">${status === 'acquired' ? '✓' : ''}</td></tr>`;
          })
          .join('');
        const viewedMaterials = uaa.resources
          .filter((resource) => this.statuses[`resource:${resource.id}`] === 'viewed')
          .map((resource) => `<li>${this.escapeHtml(resource.description)}</li>`)
          .join('');
        return rows || viewedMaterials
          ? `<h2>${this.escapeHtml(uaa.code)} - ${this.escapeHtml(uaa.name)}</h2>${rows ? `<table><thead><tr><th>Compétence</th><th class="status">ECA</th><th class="status">A</th></tr></thead><tbody>${rows}</tbody></table>` : ''}${viewedMaterials ? `<h3>Matières vues</h3><ul>${viewedMaterials}</ul>` : ''}`
          : '';
      })
      .join('');

    const title = `Bilan des compétences - ${this.student.first_name} ${this.student.last_name}`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${this.escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#172033}h1{color:#075985}h2{margin-top:24px;color:#334155}h3{margin:14px 0 6px;color:#075985}p{color:#475569}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top}th{background:#e0f2fe}.status{width:70px;text-align:center;font-weight:bold}ul{margin-top:6px}</style></head><body><h1>${this.escapeHtml(title)}</h1><p>${this.escapeHtml(this.summary.program.program?.name || this.summary.program.program?.subject?.name || '')} · ${this.escapeHtml(this.summary.program.section?.code || 'Tous niveaux')} · ${new Intl.DateTimeFormat('fr-BE').format(new Date())}</p>${sections}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.slugify(title)}.doc`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected closeWindow(): void {
    window.close();
  }

  private getFilteredItemsForExport(uaa: ProgramUaa): AssessmentItem[] {
    const previousSearch = this.searchTerm;
    this.searchTerm = '';
    const items = this.getFilteredItems(uaa);
    this.searchTerm = previousSearch;
    return this.exportMode === 'all'
      ? items
      : items.filter((item) => ['in_progress', 'acquired'].includes(this.getStatus(item)));
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return entities[character];
    });
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }
}
