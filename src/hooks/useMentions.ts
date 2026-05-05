import { useState, useRef, useEffect } from 'react';
import getCaretCoordinates from 'textarea-caret';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

export function useMentions() {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionOptions, setMentionOptions] = useState<Profile[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch profiles for mentions (AI characters and maybe top users)
  useEffect(() => {
    async function fetchProfiles() {
      if (!supabase) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_ai_character', true)
        .order('username');
      if (data) {
        setAllProfiles(data as Profile[]);
      }
    }
    fetchProfiles();
  }, []);

  const handleMentionChange = (val: string, cursorPosition: number) => {
    const textBeforeCursor = val.slice(0, cursorPosition);
    // match '@' followed by non-whitespace up to the cursor
    const match = textBeforeCursor.match(/@(\S*)$/);

    if (match && textareaRef.current) {
      const query = match[1].toLowerCase();
      setMentionQuery(query);
      
      const caret = getCaretCoordinates(textareaRef.current, cursorPosition);
      setMentionPosition({
        top: caret.top + 24, // below cursor
        left: caret.left
      });

      const filtered = allProfiles.filter(p => 
        p.username.toLowerCase().includes(query)
      );
      setMentionOptions(filtered);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (profile: Profile, currentText: string, cursorPosition: number) => {
    const textBeforeCursor = currentText.slice(0, cursorPosition);
    const textAfterCursor = currentText.slice(cursorPosition);
    const match = textBeforeCursor.match(/@(\S*)$/);
    
    if (match) {
      const start = cursorPosition - match[0].length;
      const newText = currentText.slice(0, start) + `@${profile.username} ` + textAfterCursor;
      const newCursorPos = start + profile.username.length + 2;
      return { newText, newCursorPos };
    }
    return null;
  };

  return {
    mentionQuery,
    setMentionQuery,
    mentionPosition,
    mentionOptions,
    mentionIndex,
    setMentionIndex,
    textareaRef,
    handleMentionChange,
    insertMention
  };
}
