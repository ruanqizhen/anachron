const SUPABASE_URL = "https://nmpwzeffjjlzdcfmrmwf.supabase.co";
const ANON = "sb_publishable_5ZSg6qB0_ar4r1ILZ8AKIg_c6hISPbN";
const t = await fetch(`${SUPABASE_URL}/functions/v1/daily-digest`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ANON}` },
  body: JSON.stringify({}),
});
console.log("http:", t.status);
console.log(JSON.stringify(JSON.parse(await t.text()), null, 2).slice(0, 1500));
