import { uploadPath, uploadReferences } from './upload-references';

const origin = 'https://orbit.example';
describe('local upload reference extraction', () => {
  it('recognizes images, links, reference definitions, plain mentions, and encoded nested URLs', () => {
    const text = `![image](/uploads/one.png) [asset](https://orbit.example/uploads/demo/two.svg?x=1#top)
![reference][cover]
[cover]: </uploads/three%20words.png>
\`/uploads/keep.png\`
https://elsewhere.example/uploads/external.png`;
    const refs = uploadReferences(text, origin);
    for (const path of [
      'demo/two.svg',
      'keep.png',
      'one.png',
      'three words.png',
    ])
      expect(refs.has(path)).toBe(true);
    expect(refs.has('external.png')).toBe(false);
  });
  it.each([
    '/avatars/default-raven.png',
    '/uploads/../secret',
    '/uploads/%2e%2e/secret',
    '/uploads/a%2fb/../secret',
    '/uploads/a\\b',
    '/uploads/%00x',
    '/uploads/%xx',
    'https://elsewhere.example/uploads/a.png',
  ])('excludes unsafe or external reference %s', (value) => {
    expect(uploadPath(value, origin)).toBeNull();
  });
  it('parses escaped Markdown destinations and HTML character references', () => {
    const refs = uploadReferences(
      String.raw`![a](/uploads/file\(1\).png) ![b](</uploads/a&amp;b.png>)`,
      origin,
    );
    expect(refs.has('file(1).png')).toBe(true);
    expect(refs.has('a&b.png')).toBe(true);
  });
  it('retains ambiguous punctuation and adjacent Markdown images conservatively', () => {
    const refs = uploadReferences(
      '![a](</uploads/file[1](2).png>)![b](/uploads/next.png)',
      origin,
    );
    expect(refs.has('file[1](2).png')).toBe(true);
    expect(refs.has('next.png')).toBe(true);
  });
  it('normalizes query strings, fragments, and encoded separators', () => {
    expect(uploadPath('/uploads/nested%2Fone.png?download=1#x', origin)).toBe(
      'nested/one.png',
    );
    expect(uploadPath('https://orbit.example/uploads/a.png?q=1', origin)).toBe(
      'a.png',
    );
  });
});
