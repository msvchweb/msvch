import { supabase } from "./shorts/lib/supabase";

async function resetFailedJobs() {
  console.log("Searching for failed or stuck shorts jobs...");
  
  const { data, error } = await supabase
    .from("shorts_jobs")
    .update({ 
      status: "pending", 
      error: null,
      updated_at: new Date().toISOString() 
    })
    .in("status", ["failed", "downloading", "transcribing"]) // 실패했거나 중단된 상태들
    .select();

  if (error) {
    console.error("Error resetting jobs:", error);
    return;
  }

  if (data && data.length > 0) {
    console.log(`Successfully reset ${data.length} jobs to 'pending':`);
    data.forEach(job => {
      console.log(`- ID: ${job.id}, VideoID: ${job.video_id}`);
    });
    console.log("\nNow the runner will pick them up automatically if it's running.");
  } else {
    console.log("No failed or stuck jobs found to reset.");
  }
}

resetFailedJobs();
