import { describe, expect, test } from 'vitest';
import { renderMarkdown } from './markdown.ts';

describe('renderMarkdown sanitising', () => {
  test('strips a script tag', () => {
    expect(renderMarkdown('hei <script>alert(1)</script> da')).not.toContain('<script');
  });

  test('strips an inline event handler', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">');
    expect(html).not.toContain('onerror');
  });

  test('strips a javascript: link but keeps the text', () => {
    const html = renderMarkdown('[klikk](javascript:alert(1))');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('klikk');
  });

  test('strips an iframe', () => {
    expect(renderMarkdown('<iframe src="https://evil.example"></iframe>')).not.toContain(
      '<iframe',
    );
  });
});

describe('renderMarkdown output', () => {
  test('keeps an ordinary link', () => {
    expect(renderMarkdown('[Kudos](https://kudos.example/documents/1)')).toContain(
      'href="https://kudos.example/documents/1"',
    );
  });

  test('renders the list and emphasis the answers actually use', () => {
    const html = renderMarkdown('- **fet** tekst\n- andre punkt');
    expect(html).toContain('<ul>');
    expect(html).toContain('<strong>fet</strong>');
  });

  test('renders GFM tables', () => {
    expect(renderMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')).toContain('<table>');
  });

  test('leaves [N] citation markers alone', () => {
    expect(renderMarkdown('Dette står i rapporten [1].')).toContain('[1]');
  });

  test('empty input yields empty output rather than throwing', () => {
    expect(renderMarkdown('')).toBe('');
  });
});
