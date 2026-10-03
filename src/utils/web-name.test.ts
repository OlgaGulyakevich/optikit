import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { findWebNameCollisions, slug, toWebOutput, webName, webPath } from './web-name.js';

describe('webName', () => {
  it.each([
    ['Отзыв кофе (2).MP4', 'otzyv-kofe-2.mp4'], // Cyrillic, spaces, brackets, caps extension
    ['Präsentation Zürich.mov', 'praesentation-zuerich.mov'], // German: ä→ae, ü→ue
    ['Café crème.jpg', 'cafe-creme.jpg'], // French accents dropped
    ['Řeřicha Łódź.png', 'rericha-lodz.png'], // Czech, Polish
    ['Case#2 FINAL.mp4', 'case-2-final.mp4'], // `#` would cut the URL
    ['hero.mp4', 'hero.mp4'], // already fine → unchanged
    ['Фото@2x.PNG', 'foto@2x.png'], // retina suffix survives
    ['my_icon - v2.svg', 'my_icon-v2.svg'],
    ['README', 'readme'], // no extension
  ])('%s → %s', (input, expected) => {
    expect(webName(input)).toBe(expected);
  });

  it('gives both encodings of one letter the same name (NFC vs NFD)', () => {
    const composed = 'Йогурт.mp4'.normalize('NFC');
    const decomposed = 'Йогурт.mp4'.normalize('NFD');

    expect(composed).not.toBe(decomposed); // different bytes, same look
    expect(webName(decomposed)).toBe(webName(composed));
  });

  it('falls back to "file" when nothing latin is left', () => {
    expect(webName('日本.png')).toBe('file.png');
  });
});

describe('webPath / toWebOutput', () => {
  it('renames folders too, not only the file', () => {
    expect(webPath(join('Видео', 'Отзывы', 'Кофе.mp4'))).toBe(join('video', 'otzyvy', 'kofe.mp4'));
  });

  it('leaves the output directory itself alone', () => {
    expect(toWebOutput('Public Files', join('Public Files', 'Отзыв.mp4'))).toBe(join('Public Files', 'otzyv.mp4'));
  });

  it('slugs a dotted folder name without mistaking it for an extension', () => {
    expect(slug('Release v1.2')).toBe('release-v1.2');
  });
});

describe('findWebNameCollisions', () => {
  it('catches two different names that become one', () => {
    expect(findWebNameCollisions(['Отзыв.mp4', 'otzyv.mp4'])).toEqual([['Отзыв.mp4', 'otzyv.mp4']]);
  });

  it('compares without the extension — commands change it anyway', () => {
    expect(findWebNameCollisions(['Фото.png', 'foto.jpg'])).toEqual([['Фото.png', 'foto.jpg']]);
  });

  it('ignores the same stem with another extension (not a web-names problem)', () => {
    expect(findWebNameCollisions(['photo.png', 'photo.jpg'])).toEqual([]);
  });

  it('only compares within the same folder', () => {
    expect(findWebNameCollisions([join('a', 'Отзыв.mp4'), join('b', 'otzyv.mp4')])).toEqual([]);
  });
});
