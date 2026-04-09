import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ClassJournalSlotDraft } from '../models/ClassJournal';

@Injectable({
  providedIn: 'root'
})
export class ClassJournalService {
  private readonly draftsSubject = new BehaviorSubject<Record<string, ClassJournalSlotDraft>>({});
  readonly drafts$ = this.draftsSubject.asObservable();

  updateDraft(slotKey: string, patch: Partial<ClassJournalSlotDraft>): void {
    const drafts = this.draftsSubject.value;
    const currentDraft = this.getDraft(slotKey);

    this.draftsSubject.next({
      ...drafts,
      [slotKey]: {
        ...currentDraft,
        ...patch
      }
    });
  }

  getDraft(slotKey: string): ClassJournalSlotDraft {
    return this.draftsSubject.value[slotKey] ?? {
      notes: '',
      sectionId: '',
      networkId: '',
      selectedSkillIds: [],
      selectedResourceIds: []
    };
  }

  toggleSkill(slotKey: string, skillId: string): void {
    const draft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      selectedSkillIds: this.toggleId(draft.selectedSkillIds, skillId)
    });
  }

  toggleResource(slotKey: string, resourceId: string): void {
    const draft = this.getDraft(slotKey);
    this.updateDraft(slotKey, {
      selectedResourceIds: this.toggleId(draft.selectedResourceIds, resourceId)
    });
  }

  private toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
  }
}
