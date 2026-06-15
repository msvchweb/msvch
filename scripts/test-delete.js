/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf8");
  envFile.split("\n").forEach(line => {
    const [key, value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function testDelete() {
  console.log("Testing blind delete...");
  const { data, error } = await supabase.storage.from("shorts").remove(["non-existent-file-12345"]);
  if (error) {
    console.log("Delete Error:", error.message);
  } else {
    console.log("Delete Success (or no-op):", data);
  }

  console.log("Testing blind DB delete...");
  const { error: dbError } = await supabase.from("shorts_jobs").delete().eq("id", "00000000-0000-0000-0000-000000000000");
  if (dbError) {
    console.log("DB Delete Error:", dbError.message);
  } else {
    console.log("DB Delete Success (or no-op)");
  }
}

testDelete();
