import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'secondsToHms', standalone: true })
export class SecondsToHmsPipe implements PipeTransform {
  transform(seconds: number): string {
    if (!seconds || seconds < 0) return '0h 0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
}
