import { createChildLogger } from '@clude/shared/core/logger';
import { guardBudget } from './budget';
import type { RoleName } from './types';

export interface RoleConfig {
  name: RoleName;
  intervalMs: number;
  tick: () => Promise<void>;
}

export abstract class Role {
  protected log = createChildLogger(`growth-role`);
  protected timer: ReturnType<typeof setInterval> | null = null;
  protected running = false;

  constructor(protected readonly cfg: RoleConfig) {
    this.log = createChildLogger(`growth-${cfg.name}`);
  }

  start(): void {
    if (this.timer) return;
    this.log.info({ intervalMs: this.cfg.intervalMs }, 'Role starting');
    this.timer = setInterval(() => this.safeTick(), this.cfg.intervalMs);
    // Defer first tick by 30s so workers can finish bootstrap
    setTimeout(() => this.safeTick(), 30_000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.log.info('Role stopped');
  }

  private async safeTick(): Promise<void> {
    if (this.running) {
      this.log.debug('Previous tick still running — skipping');
      return;
    }
    if (!(await guardBudget(this.cfg.name))) return;
    this.running = true;
    try {
      await this.cfg.tick();
    } catch (err) {
      this.log.error({ err }, 'Role tick failed');
    } finally {
      this.running = false;
    }
  }
}

export function makeRole(cfg: RoleConfig): Role {
  return new (class extends Role {})(cfg);
}
