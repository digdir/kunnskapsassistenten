import { describe, expect, it } from 'vitest';
import { createSseDecoder } from './sse';

describe('createSseDecoder', () => {
  it('reads one frame', () => {
    const decoder = createSseDecoder();
    expect(decoder.push('event: progress\ndata: {"a":1}\n\n')).toEqual([
      { event: 'progress', data: '{"a":1}' },
    ]);
  });

  it('waits for a frame that arrives in pieces', () => {
    const decoder = createSseDecoder();

    expect(decoder.push('data: {"half')).toEqual([]);
    expect(decoder.push(':true}\n\n')).toEqual([{ event: undefined, data: '{"half:true}' }]);
  });

  it('reads several frames out of one chunk', () => {
    const decoder = createSseDecoder();
    const frames = decoder.push('data: en\n\ndata: to\n\ndata: tre\n\n');

    expect(frames.map((frame) => frame.data)).toEqual(['en', 'to', 'tre']);
  });

  it('skips the keep-alive comments the server sends every 15 seconds', () => {
    const decoder = createSseDecoder();
    expect(decoder.push(': ping\n\n')).toEqual([]);
    expect(decoder.push(': ping\ndata: ekte\n\n')).toEqual([{ event: undefined, data: 'ekte' }]);
  });

  it('joins several data lines in the same frame', () => {
    const decoder = createSseDecoder();
    expect(decoder.push('data: ett\ndata: to\n\n')[0].data).toBe('ett\nto');
  });

  it('handles carriage returns', () => {
    const decoder = createSseDecoder();
    expect(decoder.push('data: hei\r\n\r\n')).toEqual([{ event: undefined, data: 'hei' }]);
  });

  it('gives up the last frame even without its blank line', () => {
    const decoder = createSseDecoder();
    decoder.push('data: siste\n');
    expect(decoder.flush()).toEqual([{ event: undefined, data: 'siste' }]);
    expect(decoder.flush()).toEqual([]);
  });
});
