// Parse @username mentions from content.
// Matches @username where username can contain Chinese chars, letters, digits, underscores.
// Returns unique usernames.
export function parseMentions(content: string): string[] {
  const mentions = new Set<string>();
  // Match @ followed by Chinese characters, word characters, or underscore
  const regex = /@([一-鿿\w]+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    mentions.add(match[1]);
  }
  return [...mentions];
}
