export type RichNode =
  | { kind: 'text'; text: string }
  | { kind: 'param'; name: string }
  | { kind: 'tag'; name: string; children: RichNode[] };

const token = /<(\w+)\s*\/>|<(\w+)>|<\/(\w+)>|\{(\w+)\}/g;

export const parseRich = (message: string): RichNode[] => {
  const root: RichNode[] = [];
  const stack: { name: string; children: RichNode[] }[] = [];
  const current = () => stack.at(-1)?.children ?? root;
  let last = 0;
  for (const m of message.matchAll(token)) {
    if (m.index > last) current().push({ kind: 'text', text: message.slice(last, m.index) });
    last = m.index + m[0].length;
    const [, selfClosing, open, close, param] = m;
    if (selfClosing) current().push({ kind: 'tag', name: selfClosing, children: [] });
    else if (open) stack.push({ name: open, children: [] });
    else if (close) {
      const top = stack.pop();
      if (!top || top.name !== close) throw new Error(`unbalanced <${close}> in "${message}"`);
      current().push({ kind: 'tag', name: top.name, children: top.children });
    } else if (param) current().push({ kind: 'param', name: param });
  }
  if (stack.length > 0) throw new Error(`unclosed <${stack[0]?.name}> in "${message}"`);
  if (last < message.length) current().push({ kind: 'text', text: message.slice(last) });
  return root;
};

export const tagsOf = (message: string) =>
  [...message.matchAll(/<(\w+)\s*\/?>/g)].map((m) => m[1] ?? '').sort();
