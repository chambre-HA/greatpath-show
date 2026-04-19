import type { ShowLink } from '@/types'

export type EmbedStrategy =
  | { kind: 'direct'; url: string }
  | { kind: 'office-online'; url: string }
  | { kind: 'blocked'; reason: string; openUrl: string }

const OFFICE_VIEWER = 'https://view.officeapps.live.com/op/embed.aspx?src='

export function getEmbedStrategy(link: ShowLink): EmbedStrategy {
  const url = link.url

  // OneDrive personal Doc.aspx — sends X-Frame-Options, cannot iframe.
  if (/onedrive\.live\.com\/.*Doc\.aspx/i.test(url)) {
    return {
      kind: 'blocked',
      reason:
        "OneDrive's web viewer blocks embedding. Open the file in OneDrive → Share → Embed, and paste that <iframe src=\"…\"> URL instead.",
      openUrl: url,
    }
  }

  // OneDrive/SharePoint embed URL — fine.
  if (/onedrive\.live\.com\/embed/i.test(url)) return { kind: 'direct', url }
  if (/1drv\.ms\//i.test(url)) return { kind: 'direct', url }
  if (/sharepoint\.com\/.*(embed|action=embedview)/i.test(url)) return { kind: 'direct', url }

  // Google Docs/Slides preview — fine if /preview or /embed.
  if (/docs\.google\.com\/.*\/(preview|embed)/i.test(url)) return { kind: 'direct', url }
  if (/docs\.google\.com\//i.test(url)) {
    // Try converting /edit → /preview
    const preview = url.replace(/\/edit[^?]*/, '/preview').replace(/\?usp=.*/, '')
    return { kind: 'direct', url: preview }
  }

  // Already an Office Online viewer link — fine.
  if (/view\.officeapps\.live\.com/i.test(url)) return { kind: 'direct', url }

  // WPS DocWorkspace — blocks iframe embedding.
  if (/docworkspace\.com\//i.test(url) || /docs\.wps\.com\//i.test(url)) {
    return {
      kind: 'blocked',
      reason: 'WPS DocWorkspace blocks embedding in external sites.',
      openUrl: url,
    }
  }

  // Tencent Docs (腾讯文档) — embeddable in China.
  if (/docs\.qq\.com\//i.test(url)) return { kind: 'direct', url }

  // Raw .pptx or .ppt → wrap with Office Online Viewer (requires publicly-downloadable URL).
  if (link.kind === 'ppt') {
    return { kind: 'office-online', url: `${OFFICE_VIEWER}${encodeURIComponent(url)}` }
  }

  return { kind: 'direct', url }
}
