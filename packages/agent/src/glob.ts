/** `**` matches across directories, `*` within one path segment, `?` one character. */
export function globToRegExp(glob: string): RegExp {
  let src = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      src += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') src += '[^/]*';
    else if (c === '?') src += '[^/]';
    else src += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${src}$`);
}
