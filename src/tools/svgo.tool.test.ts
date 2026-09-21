import { describe, it, expect } from 'vitest';
import { SvgParseError, hasExecutableContent } from './svgo.tool.js';

describe('SvgParseError', () => {
  it('names the file svgo itself never mentions', () => {
    const error = new SvgParseError('icons/logo.svg', new Error('<input>:1:54: Unexpected close tag'));

    expect(error.file).toBe('icons/logo.svg');
    expect(error.message).toBe('icons/logo.svg: 1:54: Unexpected close tag');
  });

  it('keeps a message that has no <input> prefix as-is', () => {
    const error = new SvgParseError('a.svg', new Error('something else went wrong'));

    expect(error.message).toBe('a.svg: something else went wrong');
  });

  it('survives a non-Error being thrown', () => {
    const error = new SvgParseError('a.svg', 'plain string');

    expect(error.message).toBe('a.svg: plain string');
  });

  it('keeps the original error reachable as cause', () => {
    const cause = new Error('<input>:1:1: Non-whitespace before first tag.');
    const error = new SvgParseError('a.svg', cause);

    expect(error.cause).toBe(cause);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('hasExecutableContent', () => {
  it.each([
    ['<script> element', '<svg><script>alert(1)</script></svg>'],
    ['self-closing script', '<svg><script src="x.js"/></svg>'],
    ['event handler', '<svg><rect onload="go()"/></svg>'],
    ['handler with spaces', '<svg><rect onclick = "go()"/></svg>'],
    ['javascript: link', '<svg><a href="javascript:go()"><rect/></a></svg>'],
    ['uppercase', '<svg><SCRIPT>alert(1)</SCRIPT></svg>'],
  ])('flags %s', (_label, svg) => {
    expect(hasExecutableContent(svg)).toBe(true);
  });

  it.each([
    ['a plain icon', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'],
    ['a normal href', '<svg><a href="/about"><rect/></a></svg>'],
    // "on" inside a word must not trip the handler pattern.
    ['a word starting with on', '<svg><title>Onion</title><rect/></svg>'],
  ])('leaves %s alone', (_label, svg) => {
    expect(hasExecutableContent(svg)).toBe(false);
  });
});
