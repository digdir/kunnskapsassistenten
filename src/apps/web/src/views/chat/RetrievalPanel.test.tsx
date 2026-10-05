import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RetrievalDetails } from '../../model';
import { RetrievalPanel } from './RetrievalPanel';

const retrieval: RetrievalDetails = {
  hitCount: 10,
  documentCount: 3,
  keywords: ['Internkontroll og risikovurdering', '5G-dekning 2023'],
};

describe('RetrievalPanel', () => {
  it('counts hits and documents with the right singular forms', () => {
    render(<RetrievalPanel retrieval={retrieval} />);
    expect(screen.getByText('10 treff i 3 dokumenter')).toBeTruthy();

    render(<RetrievalPanel retrieval={{ ...retrieval, hitCount: 1, documentCount: 1 }} />);
    expect(screen.getByText('1 treff i 1 dokument')).toBeTruthy();
  });

  it('lets every tag wrap rather than run out through the side of the card', () => {
    const { container } = render(<RetrievalPanel retrieval={retrieval} />);

    // The layout itself is CSS and measured in the browser; what this guards
    // is that no tag is left out when one is added later.
    const tags = container.querySelectorAll('.ds-tag');
    expect(tags).toHaveLength(3);
    for (const tag of tags) expect(tag.classList.contains('ka-tag--wrapping')).toBe(true);
  });
});
