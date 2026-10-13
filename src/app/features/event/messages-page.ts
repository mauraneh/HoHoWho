import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { Participant } from '../../core/models';
import { EventStore } from './event-store';
import { MessageThread } from './message-thread';

@Component({
  selector: 'app-messages-page',
  imports: [MessageThread],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as e) {
      <div class="alert alert-error" role="alert">{{ e }}</div>
    }
    @if (store.detail(); as d) {
      <div class="grid threads">
        @if (giftee(); as g) {
          <app-message-thread
            [eventId]="d.event.id"
            [receiverId]="g.id"
            role="santa"
            [heading]="'To ' + g.displayName"
            [hint]="
              'You write as “Your Secret Santa”: ' + g.displayName + ' will not see your name.'
            "
            [otherName]="g.displayName"
          />
        }
        <app-message-thread
          [eventId]="d.event.id"
          [receiverId]="d.me.id"
          role="giftee"
          heading="From my Secret Santa"
          hint="Your Santa knows who you are, you don’t know who they are. Ask away!"
          otherName="Your Secret Santa"
        />
      </div>
    }
  `,
  styles: `
    .threads {
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }
  `,
})
export class MessagesPage {
  private readonly backend = inject(HohowhoBackend);
  protected readonly store = inject(EventStore);
  protected readonly giftee = signal<Participant | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const eventId = computed(() => this.store.detail()?.event.id);
    effect(() => {
      const id = eventId();
      if (id) untracked(() => void this.loadGiftee(id));
    });
  }

  private async loadGiftee(eventId: string): Promise<void> {
    try {
      this.giftee.set((await this.backend.getGiftee(eventId))?.participant ?? null);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
