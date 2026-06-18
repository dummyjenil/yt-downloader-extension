import { setDNRHeadersForClient } from "./dnr";

export function parsePlaylistData(data: any, playlistId: string) {
  let title = "Unknown Playlist";
  let owner = "Unknown Channel";
  let description = "";
  let totalVideos = 0;
  let thumbnail = "";

  try {
    const sidebar = data.sidebar?.playlistSidebarRenderer?.items;
    if (sidebar && sidebar.length > 0) {
      const primaryInfo = sidebar[0]?.playlistSidebarPrimaryInfoRenderer;
      if (primaryInfo) {
        title = primaryInfo.title?.runs?.[0]?.text || title;
        description = primaryInfo.description?.simpleText || "";
        const stats = primaryInfo.stats || [];
        if (stats[0]?.runs?.[0]?.text) {
          const countText = stats[0].runs[0].text.replace(/,/g, "");
          totalVideos = parseInt(countText, 10) || 0;
        }

        const thumbRenderer = primaryInfo.thumbnailRenderer;
        if (thumbRenderer?.playlistVideoThumbnailRenderer) {
          const thumbs = thumbRenderer.playlistVideoThumbnailRenderer.thumbnail?.thumbnails;
          if (thumbs && thumbs.length > 0) {
            thumbnail = thumbs[thumbs.length - 1].url;
          }
        } else if (thumbRenderer?.playlistCustomThumbnailRenderer) {
          const thumbs = thumbRenderer.playlistCustomThumbnailRenderer.thumbnail?.thumbnails;
          if (thumbs && thumbs.length > 0) {
            thumbnail = thumbs[thumbs.length - 1].url;
          }
        }
      }

      const secondaryInfo = sidebar[1]?.playlistSidebarSecondaryInfoRenderer;
      if (secondaryInfo?.videoOwner?.videoOwnerRenderer) {
        owner = secondaryInfo.videoOwner.videoOwnerRenderer.title?.runs?.[0]?.text || owner;
      }
    }
  } catch (e) {
    console.warn("Failed to parse playlist sidebar metadata:", e);
  }

  let videosList: any[] = [];
  let continuationToken: string | null = null;
  let visitorData = data.responseContext?.webResponseContextExtensionData?.ytConfigData?.visitorData;

  try {
    let contents: any[] = [];

    if (data.contents?.twoColumnBrowseResultsRenderer) {
      const tabs = data.contents.twoColumnBrowseResultsRenderer.tabs;
      const tabContent = tabs?.[0]?.tabRenderer?.content;
      const sectionContents = tabContent?.sectionListRenderer?.contents;

      if (sectionContents && sectionContents.length > 0) {
        let renderer = sectionContents[0]?.itemSectionRenderer?.contents?.[0];
        if (!renderer && sectionContents.length > 1) {
          renderer = sectionContents[1]?.itemSectionRenderer?.contents?.[0];
        }

        let importantContent = null;
        if (renderer) {
          if (renderer.richGridRenderer) {
            importantContent = renderer.richGridRenderer;
          } else if (renderer.playlistVideoListRenderer) {
            importantContent = renderer.playlistVideoListRenderer;
          }
        }

        if (importantContent) {
          contents = importantContent.contents || [];
        }
      }
    } else if (data.onResponseReceivedActions) {
      const appendActions = data.onResponseReceivedActions;
      if (appendActions.length > 0) {
        contents = appendActions[0].appendContinuationItemsAction?.continuationItems || [];
      }
    }

    for (const item of contents) {
      if (item.playlistVideoRenderer) {
        const vr = item.playlistVideoRenderer;
        const videoId = vr.videoId;
        const vTitle = vr.title?.runs?.[0]?.text || "Unknown Video";
        const vAuthor = vr.shortBylineText?.runs?.[0]?.text || owner;
        const vDuration = vr.lengthText?.simpleText || "";

        let vLengthSeconds = 0;
        if (vr.lengthSeconds) {
          vLengthSeconds = parseInt(vr.lengthSeconds, 10);
        } else if (vr.lengthText?.simpleText) {
          const parts = vr.lengthText.simpleText.split(":").map(Number);
          if (parts.length === 2) {
            vLengthSeconds = parts[0] * 60 + parts[1];
          } else if (parts.length === 3) {
            vLengthSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }
        }

        const vThumbnail = vr.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/default.jpg`;

        videosList.push({
          videoId,
          title: vTitle,
          author: vAuthor,
          duration: vDuration,
          lengthSeconds: vLengthSeconds,
          thumbnail: vThumbnail
        });
      } else if (item.continuationItemRenderer) {
        const command = item.continuationItemRenderer.continuationEndpoint;
        if (command?.continuationCommand) {
          continuationToken = command.continuationCommand.token;
        } else if (command?.commandExecutorCommand?.commands) {
          for (const cmd of command.commandExecutorCommand.commands) {
            if (cmd.continuationCommand) {
              continuationToken = cmd.continuationCommand.token;
              break;
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse playlist videos:", e);
  }

  return {
    playlistId,
    title,
    author: owner,
    description,
    totalVideos,
    thumbnail,
    videos: videosList,
    continuationToken,
    visitorData
  };
}

export async function fetchPlaylistInfo(playlistId: string) {
  const url = `https://www.youtube.com/playlist?list=${playlistId}`;

  await setDNRHeadersForClient("WEB");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist page. Status: ${response.status}`);
  }

  const html = await response.text();

  const match = html.match(/var ytInitialData\s*=\s*({.+?});/);
  const match2 = html.match(/ytInitialData\s*=\s*({.+?});/);
  const rawJson = match ? match[1] : (match2 ? match2[1] : null);

  if (!rawJson) {
    throw new Error("Unable to extract ytInitialData from YouTube playlist page.");
  }

  const data = JSON.parse(rawJson);
  return parsePlaylistData(data, playlistId);
}

export async function fetchPlaylistContinuation(continuationToken: string, visitorData?: string) {
  const apiKey = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
  const url = `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}&ext_request=true`;

  await setDNRHeadersForClient("WEB");

  const payload = {
    continuation: continuationToken,
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20251021.01.00",
        visitorData: visitorData || undefined
      }
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist continuation. Status: ${response.status}`);
  }

  return response.json();
}

export async function fetchFullPlaylist(playlistId: string) {
  const initial = await fetchPlaylistInfo(playlistId);
  let allVideos = [...initial.videos];
  let continuationToken = initial.continuationToken;
  let visitorData = initial.visitorData;
  let pagesFetched = 1;
  const maxPages = 15; // Limit to 1500 videos

  while (continuationToken && pagesFetched < maxPages) {
    try {
      const contData = await fetchPlaylistContinuation(continuationToken, visitorData);

      let newVideos: any[] = [];
      let newContToken: string | null = null;

      const appendActions = contData.onResponseReceivedActions;
      const contents = appendActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];

      for (const item of contents) {
        if (item.playlistVideoRenderer) {
          const vr = item.playlistVideoRenderer;
          const videoId = vr.videoId;
          const vTitle = vr.title?.runs?.[0]?.text || "Unknown Video";
          const vAuthor = vr.shortBylineText?.runs?.[0]?.text || initial.author;
          const vDuration = vr.lengthText?.simpleText || "";

          let vLengthSeconds = 0;
          if (vr.lengthSeconds) {
            vLengthSeconds = parseInt(vr.lengthSeconds, 10);
          } else if (vr.lengthText?.simpleText) {
            const parts = vr.lengthText.simpleText.split(":").map(Number);
            if (parts.length === 2) {
              vLengthSeconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
              vLengthSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
          }

          const vThumbnail = vr.thumbnail?.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/default.jpg`;

          newVideos.push({
            videoId,
            title: vTitle,
            author: vAuthor,
            duration: vDuration,
            lengthSeconds: vLengthSeconds,
            thumbnail: vThumbnail
          });
        } else if (item.continuationItemRenderer) {
          const command = item.continuationItemRenderer.continuationEndpoint;
          if (command?.continuationCommand) {
            newContToken = command.continuationCommand.token;
          } else if (command?.commandExecutorCommand?.commands) {
            for (const cmd of command.commandExecutorCommand.commands) {
              if (cmd.continuationCommand) {
                newContToken = cmd.continuationCommand.token;
                break;
              }
            }
          }
        }
      }

      allVideos.push(...newVideos);
      continuationToken = newContToken;
      pagesFetched++;
    } catch (err) {
      console.warn("Failed to fetch playlist continuation page, stopping pagination:", err);
      break;
    }
  }

  return {
    playlistId: initial.playlistId,
    title: initial.title,
    author: initial.author,
    description: initial.description,
    totalVideos: Math.max(initial.totalVideos, allVideos.length),
    thumbnail: initial.thumbnail,
    videos: allVideos
  };
}
