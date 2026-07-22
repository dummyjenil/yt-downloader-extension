let dnrQueue: Promise<void> = Promise.resolve();

export async function setDNRHeadersForClient(clientName: "WEB" | "ANDROID_VR" | "TV") {
  dnrQueue = dnrQueue.then(async () => {
    let userAgent = "";
    let clientNameHeader = "";
    let clientVersionHeader = "";

    if (clientName === "WEB") {
      userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      clientNameHeader = "1";
      clientVersionHeader = "2.20251021.01.00";
    } else if (clientName === "ANDROID_VR") {
      userAgent = "com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip";
      clientNameHeader = "28";
      clientVersionHeader = "1.60.19";
    } else if (clientName === "TV") {
      userAgent = "Mozilla/5.0 (ChromiumStylePlatform; Widevine) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      clientNameHeader = "7";
      clientVersionHeader = "7.20240813.07.00";
    }

    const rules: chrome.declarativeNetRequest.Rule[] = [
      {
        id: 100,
        priority: 10,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            { header: "user-agent", operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: userAgent },
            { header: "x-youtube-client-name", operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: clientNameHeader },
            { header: "x-youtube-client-version", operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: clientVersionHeader },
            { header: "origin", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
            { header: "referer", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }
          ]
        },
        condition: {
          urlFilter: "*://www.youtube.com/youtubei/v1/*ext_request=true*",
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST
          ]
        }
      },
      {
        id: 101,
        priority: 10,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            { header: "user-agent", operation: chrome.declarativeNetRequest.HeaderOperation.SET, value: userAgent },
            { header: "origin", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE },
            { header: "referer", operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE }
          ]
        },
        condition: {
          urlFilter: "*ext_download=true*",
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.MEDIA,
            chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
            chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
            chrome.declarativeNetRequest.ResourceType.OTHER
          ]
        }
      }
    ];

    return new Promise<void>((resolve, reject) => {
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [100, 101],
        addRules: rules
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("DNR Rules update failed:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log(`DNR Rules registered successfully for client: ${clientName}`);
          resolve();
        }
      });
    });
  }).catch((err) => {
    console.warn("Error in DNR queue:", err);
  });

  return dnrQueue;
}
