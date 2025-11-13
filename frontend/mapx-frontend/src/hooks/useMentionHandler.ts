import { useState, useRef, useCallback } from 'react';
import { insertPlainMention } from '@/utils/mentions';
import { useMentions } from './useMentions';

interface MentionPosition {
  top: number;
  left: number;
}

// Computes caret pixel coordinates for accurate @mention picker anchoring
const getCaretGlobalPosition = (textarea: HTMLTextAreaElement, position: number) => {
  const style = window.getComputedStyle(textarea);
  const div = document.createElement('div');
  const span = document.createElement('span');
  const properties = [
    'borderLeftWidth','borderTopWidth','borderRightWidth','borderBottomWidth',
    'fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','textTransform','textAlign','textIndent',
    'whiteSpace','wordBreak','wordWrap','overflowWrap','paddingLeft','paddingTop','paddingRight','paddingBottom',
    'lineHeight','width'
  ];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  properties.forEach(prop => { (div.style as any)[prop] = (style as any)[prop]; });
  div.style.width = style.width;
  const value = textarea.value;
  const textBefore = value.substring(0, position);
  const textAfter = value.substring(position) || '.';
  div.textContent = textBefore;
  span.textContent = textAfter;
  div.appendChild(span);
  document.body.appendChild(div);
  const taRect = textarea.getBoundingClientRect();
  const divRect = div.getBoundingClientRect();
  const spanRect = span.getBoundingClientRect();
  const left = Math.min(taRect.left + (spanRect.left - divRect.left), taRect.right - 4);
  const top = taRect.top + (spanRect.top - divRect.top);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  document.body.removeChild(div);
  return { left: left + window.scrollX, top: top + window.scrollY + lineHeight, lineHeight };
};

export function useMentionHandler(currentUserId: string) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<any[]>([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionPosition, setMentionPosition] = useState<MentionPosition | null>(null);
  
  const mentions = useMentions();

  // Fetch mention suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setMentionSuggestions([]);
      return;
    }
    const list = await mentions.suggest(query, currentUserId);
    setMentionSuggestions(list);
  }, [currentUserId, mentions.suggest]);

  const handleTextChange = useCallback((
    value: string,
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    onTextChange: (value: string) => void
  ) => {
    onTextChange(value);
    
    // Detect @mention
    const pos = textareaRef.current?.selectionStart || value.length;
    const left = value.slice(0, pos);
    const at = left.lastIndexOf('@');
    
    if (at >= 0 && (at === 0 || /\s|[([{-]/.test(left[at - 1] || ''))) {
      const query = left.slice(at + 1);
      if (/^[\w.\-]{0,30}$/.test(query)) {
        setMentionQuery(query);
        setShowMentionMenu(true);
        if (textareaRef.current) {
          const el = textareaRef.current;
          const caret = getCaretGlobalPosition(el, at + 1);
          const pickerWidth = 256;
          const pickerHeight = 200;
          let top = caret.top + 4;
          let leftPx = caret.left;
          if (top + pickerHeight > window.innerHeight + window.scrollY) {
            top = caret.top - pickerHeight - 8;
          }
          if (leftPx + pickerWidth > window.innerWidth + window.scrollX) {
            leftPx = window.innerWidth + window.scrollX - pickerWidth - 8;
          }
          if (leftPx < 8 + window.scrollX) leftPx = 8 + window.scrollX;
          setMentionPosition({ top, left: leftPx });
        }
      } else {
        setShowMentionMenu(false);
        setMentionQuery(null);
      }
    } else {
      setShowMentionMenu(false);
      setMentionQuery(null);
    }
  }, []);

  const handleTextSelection = useCallback((
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    newPos: number
  ) => {
    if (showMentionMenu && textareaRef.current) {
      const textBeforeCursor = (textareaRef.current.value || '').substring(0, newPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const after = textBeforeCursor.substring(lastAtIndex + 1);
        if (/^[\w.\-]{0,30}$/.test(after)) {
          const caret = getCaretGlobalPosition(textareaRef.current, newPos);
          const pickerWidth = 256;
          const pickerHeight = 200;
          let top = caret.top + 4;
          let leftPx = caret.left;
          if (top + pickerHeight > window.innerHeight + window.scrollY) top = caret.top - pickerHeight - 8;
          if (leftPx + pickerWidth > window.innerWidth + window.scrollX) leftPx = window.innerWidth + window.scrollX - pickerWidth - 8;
          if (leftPx < 8 + window.scrollX) leftPx = 8 + window.scrollX;
          setMentionPosition({ top, left: leftPx });
        }
      }
    }
  }, [showMentionMenu]);

  const handleMentionSelect = useCallback((
    user: any,
    text: string,
    textareaRef: React.RefObject<HTMLTextAreaElement>,
    onTextChange: (value: string) => void
  ) => {
    if (!textareaRef.current) return;
    
    const cursor = textareaRef.current.selectionStart || text.length;
    const uname = (user.username || '').toLowerCase() || (user.display_name || user.user_name || '').toLowerCase().replace(/\s+/g, '');
    const { text: newText, newCursor } = insertPlainMention(text, cursor, uname);
    
    // Remember mapping for conversion on submit
    const display = user.display_name || user.user_name || uname;
    mentions.rememberMapping(uname, { id: user.id, displayName: display });
    
    onTextChange(newText);
    setShowMentionMenu(false);
    setMentionQuery(null);
    setMentionPosition(null);
    
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    });
  }, [mentions.rememberMapping]);

  const closeMentionMenu = useCallback(() => {
    setShowMentionMenu(false);
    setMentionQuery(null);
    setMentionPosition(null);
  }, []);

  return {
    mentionQuery,
    mentionSuggestions,
    showMentionMenu,
    mentionPosition,
    fetchSuggestions,
    handleTextChange,
    handleTextSelection,
    handleMentionSelect,
    closeMentionMenu,
    getMapping: mentions.getMapping
  };
}
