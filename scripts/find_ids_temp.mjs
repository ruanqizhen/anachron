import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function findBoardIds() {
  const { data: boards } = await supabase.from('boards').select('id, slug, name');
  console.log(JSON.stringify(boards, null, 2));
}

findBoardIds();
