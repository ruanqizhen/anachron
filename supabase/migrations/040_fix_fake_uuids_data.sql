DO $$
DECLARE
  map jsonb := '{
    "a1111111-1111-4111-a111-111111111111": "b2223678-c7cc-4864-8dbc-8e4c0b6b45ed",
    "b2222222-2222-4222-b222-222222222222": "56d7426f-9845-4738-9222-47fa66c39ca9",
    "c3333333-3333-4333-c333-333333333333": "d887f246-432e-447e-bc35-4958ed34d4a6",
    "d4444444-4444-4444-d444-444444444444": "0cd0060c-e208-4143-98e9-368cc6405973",
    "e5555555-5555-4555-e555-555555555555": "11c008c0-492d-4653-b13e-97f400b1babe",
    "f1111111-1111-4111-f111-111111111111": "0fbbe784-92d6-4882-a0e8-f8452dd97f88",
    "f2222222-2222-4222-f222-222222222222": "9c3267e5-a5f9-4e59-9918-0b8a722ad9df",
    "f3333333-3333-4333-f333-333333333333": "ef453757-3d70-4432-a57e-71ce2862b028",
    "f4444444-4444-4444-f444-444444444444": "66e5c962-54df-4849-860d-a2bea0e87617",
    "f5555555-5555-4555-f555-555555555555": "6b90b211-a287-48c4-8112-8d30de3ffdfc",
    "f6666666-6666-4666-f666-666666666666": "a8e3ab8c-e58b-4635-9b9d-0b87a8565514",
    "f7777777-7777-4777-f777-777777777777": "7b2f0111-80d0-4283-900a-b8b53a57a61e",
    "c1111111-1111-4111-c111-111111111111": "81a8f947-2c97-4258-86fc-b6db94901f4c",
    "c2222222-2222-4222-c222-222222222222": "7d8f2cfb-b5cc-44a5-b1a9-d5c2e27b40d1",
    "c3333333-3333-4333-c333-333333333333": "a9e6d0bb-a309-4828-98f6-fcb9f848b8c2",
    "c4444444-4444-4444-c444-444444444444": "96b01438-fb15-46f0-bba7-14bebdcfbb50",
    "c5555555-5555-4555-c555-555555555555": "e1c4a098-9bb3-4ef3-a3d8-5b4cf2f0f49c",
    "c6666666-6666-4666-c666-666666666666": "f38d4b2e-7443-4dc9-98c5-926d57bcf879",
    "c7777777-7777-4777-c777-777777777777": "475b8a6e-3489-4a9f-8648-fb9e2c695b28",
    "c8888888-8888-4888-c888-888888888888": "2ccfa71d-5b23-4df4-a4f1-6784b25e1007",
    "c9999999-9999-4999-c999-999999999999": "b9df32e4-948f-4d98-be92-4e0821c179cf",
    "caaaaaaa-aaaa-4aaa-caaa-aaaaaaaaaaaa": "1938f4d9-813c-4b36-a3c9-9407ec0f3a6a"
  }';
  k text;
  v text;
BEGIN
  FOR k, v IN SELECT * FROM jsonb_each_text(map)
  LOOP
    -- 0. Rename the old profile username to avoid UNIQUE constraint violation
    UPDATE profiles SET username = username || '_temp' WHERE id = k::uuid;

    -- 1. Create a copy of the profile with the new real UUID
    INSERT INTO profiles (id, username, avatar_url, bio, is_ai_character, is_admin, created_at)
    SELECT v::uuid, REPLACE(username, '_temp', ''), avatar_url, bio, is_ai_character, is_admin, created_at 
    FROM profiles WHERE id = k::uuid
    ON CONFLICT (id) DO NOTHING;
    
    -- 2. Create a copy of the ai_character with the new real UUID
    INSERT INTO ai_characters (id, era, tags, birth_year, death_year, personality_prompt, comedy_notes, writing_style, preferred_user_ids, is_active, created_at, updated_at)
    SELECT v::uuid, era, tags, birth_year, death_year, personality_prompt, comedy_notes, writing_style, preferred_user_ids, is_active, created_at, updated_at
    FROM ai_characters WHERE id = k::uuid
    ON CONFLICT (id) DO NOTHING;

    -- 3. Move posts and threads to the new UUID
    UPDATE posts SET author_id = v::uuid WHERE author_id = k::uuid;
    UPDATE threads SET author_id = v::uuid WHERE author_id = k::uuid;
    
    -- 4. Delete the old fake UUID records
    DELETE FROM ai_characters WHERE id = k::uuid;
    DELETE FROM profiles WHERE id = k::uuid;
  END LOOP;
END $$;
