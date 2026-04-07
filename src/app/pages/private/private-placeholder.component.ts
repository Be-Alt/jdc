import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-private-placeholder',
  templateUrl: './private-placeholder.component.html'
})
export class PrivatePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly title =
    this.route.snapshot.data['title'] as string | undefined ?? 'Section privée';
  protected readonly description =
    this.route.snapshot.data['description'] as string | undefined ??
    'Cette section sera construite progressivement.';
}
