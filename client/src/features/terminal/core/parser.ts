export function parseCommand(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return { command: '', args: [], flags: {} };

  // Regex to match words, or quoted strings
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const tokens: string[] = [];
  let match;
  while ((match = regex.exec(trimmed)) !== null) {
    // push the captured group (without quotes) or the whole match
    tokens.push(match[1] || match[2] || match[0]);
  }

  if (tokens.length === 0) return { command: '', args: [], flags: {} };

  const command = tokens[0].toLowerCase();
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('--')) {
      const flag = token.substring(2);
      // check if next token is a value (not starting with -)
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        flags[flag] = tokens[i + 1];
        i++;
      } else {
        flags[flag] = true;
      }
    } else if (token.startsWith('-')) {
      const flag = token.substring(1);
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        flags[flag] = tokens[i + 1];
        i++;
      } else {
        flags[flag] = true;
      }
    } else {
      args.push(token);
    }
  }

  return { command, args, flags };
}
