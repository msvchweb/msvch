const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

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
  console.error("Missing env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const supabase = createClient(url, key);

async function diagnose() {
  const buckets = ["gallery", "weeklies", "shorts", "blog-images", "board-images", "poster-images"];
  
  console.log("--- Storage Usage Diagnostic ---");
  let totalProjectSize = 0;
  for (const bucket of buckets) {
    try {
      const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000 });
      if (error) {
        console.log(`Bucket [${bucket}]: Error - ${error.message}`);
        continue;
      }
      
      let bucketSize = 0;
      let fileCount = 0;
      for (const file of data || []) {
        if (file.metadata && file.metadata.size) {
          bucketSize += file.metadata.size;
          fileCount++;
        }
      }
      
      // Also check subfolders (shallowly for this diagnostic)
      const folders = (data || []).filter(f => !f.id);
      for (const folder of folders) {
          const { data: subFiles } = await supabase.storage.from(bucket).list(folder.name);
          for (const sf of subFiles || []) {
              if (sf.metadata && sf.metadata.size) {
                  bucketSize += sf.metadata.size;
                  fileCount++;
              }
          }
      }

      console.log(`Bucket [${bucket}]: ${fileCount} files, ${(bucketSize / 1024 / 1024).toFixed(2)} MB`);
      totalProjectSize += bucketSize;

    } catch (e) {
      console.log(`Bucket [${bucket}]: Exception - ${e.message}`);
    }
  }
  console.log(`\nTotal Storage Size: ${(totalProjectSize / 1024 / 1024).toFixed(2)} MB / 1024.00 MB (Free Tier)`);

  console.log("\n--- Database Row Counts ---");
  const tables = [
    "profiles", "notices", "weeklies", "gallery_albums", "gallery_images", 
    "sermon_videos", "shorts_jobs", "shorts_clips", "weekly_imports",
    "board_posts", "board_comments", "chat_inquiries", "alimtalk_sent"
  ];

  for (const table of tables) {
    try {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
        if (error) {
          console.log(`Table [${table}]: Error - ${error.message}`);
        } else {
          console.log(`Table [${table}]: ${count} rows`);
        }
    } catch (e) {
        console.log(`Table [${table}]: Exception - ${e.message}`);
    }
  }
}

diagnose();
