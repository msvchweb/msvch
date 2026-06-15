import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local manually
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

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

async function diagnose() {
  const buckets = ["gallery", "weeklies", "shorts", "blog-images", "board-images", "poster-images"];
  
  console.log("--- Storage Usage Diagnostic ---");
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
      if (error) {
        console.log(`Bucket [${bucket}]: Error - ${error.message}`);
        continue;
      }
      
      let totalSize = 0;
      let fileCount = 0;
      for (const file of data || []) {
        if (file.metadata?.size) {
          totalSize += file.metadata.size;
          fileCount++;
        }
      }
      
      console.log(`Bucket [${bucket}]: ${fileCount} files, ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      
      // If it's shorts, also check subfolders
      if (bucket === "shorts") {
          const { data: folders } = await supabase.storage.from(bucket).list();
          for(const f of folders || []) {
              if (f.id === undefined) { // It's a folder
                  const { data: subFiles } = await supabase.storage.from(bucket).list(f.name);
                  let subSize = 0;
                  for (const sf of subFiles || []) {
                      subSize += sf.metadata?.size || 0;
                  }
                  if (subSize > 0) {
                      console.log(`  Folder [${f.name}]: ${(subSize / 1024 / 1024).toFixed(2)} MB`);
                  }
              }
          }
      }

    } catch (e) {
      console.log(`Bucket [${bucket}]: Exception - ${e}`);
    }
  }

  console.log("\n--- Database Row Counts ---");
  const tables = [
    "profiles", "notices", "weeklies", "gallery_albums", "gallery_images", 
    "sermon_videos", "shorts_jobs", "shorts_clips", "weekly_imports",
    "board_posts", "board_comments", "chat_inquiries", "alimtalk_sent"
  ];

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`Table [${table}]: Error - ${error.message}`);
    } else {
      console.log(`Table [${table}]: ${count} rows`);
    }
  }
}

diagnose();
