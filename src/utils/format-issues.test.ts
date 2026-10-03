import { describe, it, expect } from 'vitest';
import { formatIssues } from './format-issues.js';

describe('formatIssues', () => {
  it('names the flag the way it is typed in the terminal', () => {
    expect(
      formatIssues([
        { path: ['quality'], message: 'Too big: expected number to be <=100' },
        { path: ['sameAs'], message: 'Too small' },
        { path: ['input'], message: 'Too small' },
      ]),
    ).toEqual([
      '--quality: Too big: expected number to be <=100',
      '--same-as: Too small',
      '<input>: Too small',
    ]);
  });

  it('keeps a message with no path as-is', () => {
    expect(formatIssues([{ path: [], message: 'Invalid input' }])).toEqual(['Invalid input']);
  });
});
