import React from 'react';
const TOKEN_REGEX = /@\[(?<id>[a-f0-9-]{36}):(?<name>[^\]]+)\]/gi;

export function renderWithMentions(text: string, onUserClick?: (userId: string) => void): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    const start = match.index;
    const end = TOKEN_REGEX.lastIndex;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const id = match.groups?.id as string;
    const name = match.groups?.name as string;
    parts.push(
      <button key={`${id}-${start}`} className="text-blue-600 hover:underline"
        onClick={onUserClick ? () => onUserClick(id) : undefined}>
        {name}
      </button>
    );
    lastIndex = end;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// Inserts a plain @username mention at the current query position
export function insertPlainMention(input: string, cursor: number, username: string): { text: string; newCursor: number } {
  const left = input.slice(0, cursor);
  const right = input.slice(cursor);
  const atIndex = left.lastIndexOf('@');
  const token = `@${username}`;
  if (atIndex === -1) {
    const text = left + token + right;
    return { text, newCursor: (left + token).length };
  }
  const before = input.slice(0, atIndex);
  const text = `${before}${token}${right}`;
  const newCursor = (before + token).length;
  return { text, newCursor };
}

// Converts @username mentions to stable tokens using a username->(id, displayName) map
export function convertUsernamesToTokens(
  text: string,
  usernameToUser: Record<string, { id: string; displayName: string }>
): string {
  if (!text) return text;
  return text.replace(/@([A-Za-z0-9_.-]{1,30})/g, (match, uname: string) => {
    const user = usernameToUser[uname];
    if (!user) return match;
    return `@[${user.id}:${user.displayName}]`;
  });
}


