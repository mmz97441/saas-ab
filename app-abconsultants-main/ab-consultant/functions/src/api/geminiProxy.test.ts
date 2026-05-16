import { describe, it, expect } from 'vitest';
import { validateAttachments } from './geminiProxy';

describe('validateAttachments', () => {
  it('returns valid=true for undefined and null', () => {
    expect(validateAttachments(undefined).valid).toBe(true);
    expect(validateAttachments(null).valid).toBe(true);
  });

  it('returns empty attachments array for undefined / null input', () => {
    expect(validateAttachments(undefined).attachments).toEqual([]);
    expect(validateAttachments(null).attachments).toEqual([]);
  });

  it('rejects non-array input', () => {
    const result = validateAttachments({ mimeType: 'image/png' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/tableau/i);
  });

  it('rejects more than 4 attachments', () => {
    const five = Array.from({ length: 5 }, () => ({
      mimeType: 'image/png',
      data: 'aaa',
    }));
    const result = validateAttachments(five);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/max 4|max\s*4/i);
  });

  it('accepts exactly 4 attachments (boundary)', () => {
    const four = Array.from({ length: 4 }, () => ({
      mimeType: 'image/png',
      data: 'aaa',
    }));
    expect(validateAttachments(four).valid).toBe(true);
  });

  it('rejects unsupported mime types', () => {
    const result = validateAttachments([
      { mimeType: 'video/mp4', data: 'aaa' },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/non support|inconnu/i);
  });

  it('rejects missing mime type', () => {
    const result = validateAttachments([{ data: 'aaa' }]);
    expect(result.valid).toBe(false);
  });

  it('rejects non-object array items', () => {
    const result = validateAttachments(['notanobject']);
    expect(result.valid).toBe(false);
  });

  it('rejects attachments with empty data', () => {
    const result = validateAttachments([{ mimeType: 'image/png', data: '' }]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/vide/i);
  });

  it('accepts image/png + application/pdf together', () => {
    const result = validateAttachments([
      { mimeType: 'image/png', data: 'aaa' },
      { mimeType: 'application/pdf', data: 'bbb' },
    ]);
    expect(result.valid).toBe(true);
    expect(result.attachments).toHaveLength(2);
  });

  it('accepts image/jpeg, image/jpg, image/webp', () => {
    const result = validateAttachments([
      { mimeType: 'image/jpeg', data: 'aaa' },
      { mimeType: 'image/jpg', data: 'bbb' },
      { mimeType: 'image/webp', data: 'ccc' },
    ]);
    expect(result.valid).toBe(true);
  });

  it('normalizes mimeType to lowercase', () => {
    const result = validateAttachments([
      { mimeType: 'IMAGE/PNG', data: 'aaa' },
    ]);
    expect(result.valid).toBe(true);
    expect(result.attachments[0].mimeType).toBe('image/png');
  });

  it('preserves optional name field', () => {
    const result = validateAttachments([
      { mimeType: 'image/png', data: 'aaa', name: 'photo.png' },
    ]);
    expect(result.valid).toBe(true);
    expect(result.attachments[0].name).toBe('photo.png');
  });

  it('rejects when total decoded size exceeds 10MB', () => {
    // base64 length 14_000_000 → decoded ≈ 10.5MB → over the 10MB cap.
    const bigData = 'A'.repeat(14_000_000);
    const result = validateAttachments([
      { mimeType: 'image/png', data: bigData },
    ]);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/volumineuses|10\s*MB/i);
  });

  it('returns valid=true for empty array', () => {
    const result = validateAttachments([]);
    expect(result.valid).toBe(true);
    expect(result.attachments).toHaveLength(0);
  });
});
