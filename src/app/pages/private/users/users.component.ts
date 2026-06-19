import { DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { apiFetch } from '../../../helpers/api-session';
import { AppRole } from '../../../models/Auth';

type ManagedUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

@Component({
  selector: 'app-users',
  imports: [FormsModule, DatePipe],
  template: `
    <section class="space-y-6">
      <div>
        <p class="text-sm font-medium tracking-[0.2em] text-sky-700 uppercase">Super administration</p>
        <h2 class="mt-2 text-3xl font-semibold text-slate-950">Utilisateurs et rôles</h2>
        <p class="mt-2 text-sm text-slate-600">Les changements prennent effet à la prochaine reconnexion de l’utilisateur.</p>
      </div>

      @if (errorMessage) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ errorMessage }}</div>
      }

      <div class="overflow-x-auto rounded-[1.8rem] border border-slate-200 bg-white shadow-sm">
        <table class="min-w-[760px] w-full border-collapse">
          <thead class="bg-slate-950 text-left text-white">
            <tr>
              <th class="px-5 py-4 text-xs font-semibold uppercase">Utilisateur</th>
              <th class="px-5 py-4 text-xs font-semibold uppercase">Rôle</th>
              <th class="px-5 py-4 text-xs font-semibold uppercase">Créé le</th>
            </tr>
          </thead>
          <tbody>
            @for (user of users; track user.user_id) {
              <tr class="border-t border-slate-200">
                <td class="px-5 py-4">
                  <p class="font-medium text-slate-900">{{ user.full_name || 'Sans nom' }}</p>
                  <p class="mt-1 text-sm text-slate-500">{{ user.email }}</p>
                </td>
                <td class="px-5 py-4">
                  <select
                    [ngModel]="user.role"
                    (ngModelChange)="changeRole(user, $event)"
                    [disabled]="savingUserId === user.user_id"
                    class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    @for (role of roles; track role.value) {
                      <option [value]="role.value">{{ role.label }}</option>
                    }
                  </select>
                </td>
                <td class="px-5 py-4 text-sm text-slate-600">{{ user.created_at | date: 'dd/MM/yyyy' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="3" class="px-5 py-8 text-center text-sm text-slate-600">Aucun utilisateur.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class UsersComponent implements OnInit {
  protected users: ManagedUser[] = [];
  protected errorMessage = '';
  protected savingUserId = '';
  protected readonly roles: Array<{ value: AppRole; label: string }> = [
    { value: 'super_admin', label: 'Super administrateur' },
    { value: 'program_admin', label: 'Administrateur programme' },
    { value: 'direction_admin', label: 'Administrateur direction' },
    { value: 'teacher', label: 'Professeur' }
  ];

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected async changeRole(user: ManagedUser, role: AppRole): Promise<void> {
    this.savingUserId = user.user_id;
    try {
      const response = await apiFetch('/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.user_id, role })
      });
      const payload = await response.json() as { data?: ManagedUser[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Impossible de modifier le rôle.');
      this.users = payload.data ?? [];
      this.errorMessage = '';
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de modifier le rôle.';
    } finally {
      this.savingUserId = '';
    }
  }

  private async load(): Promise<void> {
    try {
      const response = await apiFetch('/users', { method: 'GET' });
      const payload = await response.json() as { data?: ManagedUser[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Impossible de charger les utilisateurs.');
      this.users = payload.data ?? [];
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Impossible de charger les utilisateurs.';
    }
  }
}
