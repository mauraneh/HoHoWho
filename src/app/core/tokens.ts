import { InjectionToken } from '@angular/core';
import { DataSource } from '../../environments/environment.model';

export const DATA_SOURCE = new InjectionToken<DataSource>('DATA_SOURCE');
