import { CONFIG_DEFAULTS } from '../../common/config.service';
import { panelVotePassed, routeForTargetGrade } from './routing';

const cfg = (key: string) => CONFIG_DEFAULTS[key];

describe('cert routing (ticket 03 seam)', () => {
  it('maps target grades to PRD routes', () => {
    expect(routeForTargetGrade('P2', cfg)).toBe('MANAGER_SINGLE');
    expect(routeForTargetGrade('P3', cfg)).toBe('PANEL_VOTE');
    expect(routeForTargetGrade('P4', cfg)).toBe('COMMITTEE_FINAL');
    expect(routeForTargetGrade('P5', cfg)).toBe('COMMITTEE_FINAL');
  });

  it('tenant override changes the route', () => {
    const override = (key: string) => (key === 'cert.route.p3' ? 'COMMITTEE_FINAL' : CONFIG_DEFAULTS[key]);
    expect(routeForTargetGrade('P3', override)).toBe('COMMITTEE_FINAL');
  });

  it('panel vote passes at >= 0.5 approve ratio', () => {
    const votes = [
      { voter_id: 'a', approve: true },
      { voter_id: 'b', approve: true },
      { voter_id: 'c', approve: false },
    ];
    expect(panelVotePassed(votes, 0.5)).toBe(true);
    expect(panelVotePassed(votes, 0.8)).toBe(false);
  });

  it('empty panel never passes', () => {
    expect(panelVotePassed([], 0.5)).toBe(false);
  });
});
