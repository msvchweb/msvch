export interface SourceVideo {
  videoId: string;
  title: string;
  channelId: string;
  publishedAt: string;
  durationSec: number;
  category: string;
  liveStatus: string;
  inSourcePlaylist: boolean;
}
export interface SourcePolicy {
  enabled: boolean;
  sourceChannelId: string;
  sourcePlaylistId: string;
  allowedCategories: string[];
  enabledAfter: string;
  publishedVideoIds: string[];
}
export function isEligibleForAutoGeneration(
  video: SourceVideo,
  policy: SourcePolicy,
) {
  const published = Date.parse(video.publishedAt),
    after = Date.parse(policy.enabledAfter);
  return (
    policy.enabled &&
    !!policy.sourcePlaylistId &&
    !!policy.sourceChannelId &&
    video.inSourcePlaylist &&
    video.channelId === policy.sourceChannelId &&
    Number.isFinite(published) &&
    Number.isFinite(after) &&
    published >= after &&
    Number.isFinite(video.durationSec) &&
    video.durationSec > 180 &&
    !["live", "upcoming"].includes(video.liveStatus) &&
    policy.allowedCategories.includes(video.category) &&
    !policy.publishedVideoIds.includes(video.videoId) &&
    !/예배\s*(전체|실황)|전체\s*예배|full\s*(service|worship)|worship\s*service/i.test(
      video.title,
    )
  );
}
