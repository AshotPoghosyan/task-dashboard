import { describe, expect, it } from 'vitest';
import { parseLinkHints } from './linkHints.js';

describe('parseLinkHints', () => {
  it('reads Task: #id', () => {
    expect(parseLinkHints('Fixes things\nTask: #cabc123', 'GITLAB')).toEqual({
      taskId: 'cabc123',
      parentNumber: null,
    });
  });

  it('reads GitLab parents as !n and ignores #n', () => {
    expect(parseLinkHints('Parent: !15', 'GITLAB').parentNumber).toBe(15);
    expect(parseLinkHints('Parent: #15', 'GITLAB').parentNumber).toBeNull();
  });

  it('reads GitHub parents as #n and ignores !n', () => {
    expect(parseLinkHints('parent: #15', 'GITHUB').parentNumber).toBe(15);
    expect(parseLinkHints('Parent: !15', 'GITHUB').parentNumber).toBeNull();
  });

  it('handles empty descriptions', () => {
    expect(parseLinkHints(null, 'GITHUB')).toEqual({ taskId: null, parentNumber: null });
  });
});
