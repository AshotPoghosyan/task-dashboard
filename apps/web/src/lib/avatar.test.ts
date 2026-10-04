import { AVATAR_COLORS, avatarColorIndex, initials } from './avatar';

describe('initials', () => {
  it('uses the first letters of the first two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('grace brewster murray hopper')).toBe('GB');
  });

  it('uses one letter for a single word and splits usernames on . _ -', () => {
    expect(initials('ada')).toBe('A');
    expect(initials('ada.lovelace')).toBe('AL');
    expect(initials('e2e-bot')).toBe('EB');
  });

  it('falls back to a placeholder for an empty name', () => {
    expect(initials('   ')).toBe('?');
  });
});

describe('avatarColorIndex', () => {
  it('is stable and ignores case and surrounding spaces', () => {
    expect(avatarColorIndex('Ada Lovelace')).toBe(avatarColorIndex('  ada lovelace '));
  });

  it('always lands on a defined color slot and uses more than one', () => {
    const names = ['Ada', 'Grace', 'Alan', 'Edsger', 'Linus', 'Margaret', 'Dennis', 'Ken'];
    const slots = names.map(avatarColorIndex);
    expect(slots.every((i) => i >= 0 && i < AVATAR_COLORS && Number.isInteger(i))).toBe(true);
    expect(new Set(slots).size).toBeGreaterThan(1);
  });
});
