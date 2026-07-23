import { getClientConfig, type YouTubeClientKey } from "~/utils/youtube-clients"

let dnrQueue: Promise<void> = Promise.resolve()

export async function setDNRHeadersForClient(clientName: YouTubeClientKey) {
  dnrQueue = dnrQueue
    .then(async () => {
      const config = getClientConfig(clientName)
      const userAgent = config.userAgent
      const clientNameHeader = config.clientNameHeader
      const clientVersionHeader = config.clientVersionHeader

      const rules: chrome.declarativeNetRequest.Rule[] = [
        {
          id: 100,
          priority: 10,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: "user-agent",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: userAgent
              },
              {
                header: "x-youtube-client-name",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: clientNameHeader
              },
              {
                header: "x-youtube-client-version",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: clientVersionHeader
              },
              {
                header: "origin",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "referer",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              }
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
              {
                header: "user-agent",
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: userAgent
              },
              {
                header: "origin",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              },
              {
                header: "referer",
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE
              }
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
      ]

      return new Promise<void>((resolve, reject) => {
        chrome.declarativeNetRequest.updateSessionRules(
          {
            removeRuleIds: [100, 101],
            addRules: rules
          },
          () => {
            if (chrome.runtime.lastError) {
              console.error(
                "DNR Rules update failed:",
                chrome.runtime.lastError
              )
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              console.log(
                `DNR Rules registered successfully for client: ${clientName}`
              )
              resolve()
            }
          }
        )
      })
    })
    .catch((err) => {
      console.warn("Error in DNR queue:", err)
    })

  return dnrQueue
}
