import { inject, Injectable, signal } from '@angular/core';
import { HohowhoBackend } from '../../core/backend/hohowho-backend';
import { errorMessage } from '../../core/format';
import { EventDetail } from '../../core/models';

/** Holds the event being viewed; provided by EventShell and shared with its tab pages. */
@Injectable()
export class EventStore {
  private readonly backend = inject(HohowhoBackend);
  private eventId: string | null = null;

  readonly detail = signal<EventDetail | null>(null);
  readonly error = signal<string | null>(null);

  async load(eventId: string): Promise<void> {
    if (eventId !== this.eventId) this.detail.set(null);
    this.eventId = eventId;
    this.error.set(null);
    try {
      const detail = await this.backend.getEvent(eventId);
      if (this.eventId === eventId) this.detail.set(detail);
    } catch (e) {
      if (this.eventId === eventId) this.error.set(errorMessage(e));
    }
  }

  reload(): Promise<void> {
    return this.eventId ? this.load(this.eventId) : Promise.resolve();
  }
}
