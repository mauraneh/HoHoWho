import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { Message, ThreadRole } from '../../core/models';

const REFRESH_MS = 20_000;

/** One anonymous conversation between a Secret Santa and their giftee. */
@Component({
  selector: 'app-message-thread',
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <div class="spread">
        <h2>{{ heading() }}</h2>
        <button type="button" class="btn btn-sm" (click)="refresh()" [disabled]="loading()">
          Actualiser
        </button>
      </div>
      <p class="muted small">{{ hint() }}</p>

      @if (error(); as e) {
        <div class="alert alert-error" role="alert">{{ e }}</div>
      }

      <ol class="messages" aria-live="polite">
        @for (m of messages(); track m.id) {
          <li [class.mine]="isMine(m)">
            <div class="bubble">{{ m.body }}</div>
            <div class="meta">
              {{ isMine(m) ? 'Toi' : otherName() }} · {{ m.createdAt | date: 'short' }}
            </div>
          </li>
        } @empty {
          <li class="muted small empty-thread">Pas encore de message. Lance-toi !</li>
        }
      </ol>

      <form (ngSubmit)="send()" class="composer">
        <label class="visually-hidden" [for]="role() + '-message'">Message</label>
        <textarea
          [id]="role() + '-message'"
          name="body"
          [(ngModel)]="draft"
          maxlength="2000"
          rows="2"
          placeholder="Écris un message…"
        ></textarea>
        <button type="submit" class="btn btn-primary" [disabled]="sending() || !draft.trim()">
          Envoyer
        </button>
      </form>
    </section>
  `,
  styles: `
    .messages {
      list-style: none;
      padding: 0;
      margin: 0 0 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-height: 420px;
      overflow-y: auto;
    }
    .messages li {
      max-width: 80%;
    }
    .messages li.mine {
      align-self: flex-end;
      text-align: right;
    }
    .bubble {
      display: inline-block;
      text-align: left;
      padding: 0.5rem 0.8rem;
      border-radius: 14px;
      background: #f1ece6;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .mine .bubble {
      background: var(--red);
      color: #fff;
    }
    .meta {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 0.15rem;
    }
    .composer {
      display: flex;
      gap: 0.5rem;
      align-items: flex-end;
    }
    .empty-thread {
      max-width: none;
    }
  `,
})
export class MessageThread {
  private readonly backend = inject(HohowhoBackend);

  readonly eventId = input.required<string>();
  /** Participant id of the receiver, which identifies the thread. */
  readonly receiverId = input.required<string>();
  readonly role = input.required<ThreadRole>();
  readonly heading = input.required<string>();
  readonly hint = input('');
  readonly otherName = input.required<string>();

  protected readonly messages = signal<Message[]>([]);
  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected draft = '';

  constructor() {
    effect(() => {
      const eventId = this.eventId();
      const receiverId = this.receiverId();
      untracked(() => void this.load(eventId, receiverId));
    });
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.refresh();
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  isMine(message: Message): boolean {
    return message.fromSanta === (this.role() === 'santa');
  }

  refresh(): Promise<void> {
    return this.load(this.eventId(), this.receiverId());
  }

  private async load(eventId: string, receiverId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.messages.set(await this.backend.listMessages(eventId, receiverId));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async send(): Promise<void> {
    const body = this.draft.trim();
    if (!body) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.backend.sendMessage(this.eventId(), this.receiverId(), this.role(), body);
      this.draft = '';
      await this.refresh();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.sending.set(false);
    }
  }
}
