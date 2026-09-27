import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// ADR-0006: tenant_config shell. Defaults are the PRD hardcoded values;
// a tenant row in tenant_config overrides the default.
export const CONFIG_DEFAULTS: Record<string, string> = {
  'cert.exam.retake.max': '1',
  'cert.exam.pass_score': '60',
  'cert.material.resubmit.max': '3',
  'cert.defense.cooldown_days': '90',
  'cert.batch.timeout_days': '60',
  'cert.route.p2': 'MANAGER_SINGLE', // target grade P2 -> manager single review
  'cert.route.p3': 'PANEL_VOTE', // target grade P3 -> panel 3-5 vote
  'cert.route.p4': 'COMMITTEE_FINAL', // P4+ -> committee final
  'cert.route.p5': 'COMMITTEE_FINAL',
  'cert.panel.pass_ratio': '0.5', // panel vote pass threshold
  'profile.mask.roles': 'EMPLOYEE', // roles that only see own profile
};

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string, key: string): Promise<string> {
    const row = await this.prisma.tenant_config.findUnique({
      where: { tenant_id_config_key: { tenant_id: tenantId, config_key: key } },
    });
    if (row) return row.config_value;
    if (key in CONFIG_DEFAULTS) return CONFIG_DEFAULTS[key];
    throw new Error(`unknown config key: ${key}`);
  }

  async getNumber(tenantId: string, key: string): Promise<number> {
    return Number(await this.get(tenantId, key));
  }
}
