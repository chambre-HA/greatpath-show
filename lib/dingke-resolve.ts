import { DEFAULT_DINGKE_SECTIONS } from './dingke-content'
import type { DingkeBlock, DingkeOverrides, DingkeSection, DingkeSectionOverride } from '@/types'

/** Paragraphs opening with one of these read as 主持人白 cues rather than body text. */
const CUE_PREFIXES = ['主持人白', '主持人', '轮值主持', '白：', '白:']

/**
 * Turns an edited script back into blocks. Paragraphs are blank-line separated;
 * a leading 「主持人白：」marks a cue, a leading 「※」marks a note, and a paragraph
 * whose lines are all short renders as a chant so it stays centred and large.
 */
export function parseBody(body: string): DingkeBlock[] {
  return body
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map<DingkeBlock>(para => {
      if (para.startsWith('※')) return { kind: 'note', text: para.replace(/^※\s*/, '') }
      if (para === '{{回向名单}}') return { kind: 'dedication' }
      if (CUE_PREFIXES.some(prefix => para.startsWith(prefix))) return { kind: 'cue', text: para }
      const lines = para.split('\n')
      if (lines.length > 1 && lines.every(l => l.trim().length <= 20)) {
        return { kind: 'chant', text: para }
      }
      return { kind: 'text', text: para }
    })
}

/** The inverse of parseBody — what the editor shows for an unedited section. */
export function blocksToBody(blocks: DingkeBlock[]): string {
  return blocks
    .map(block => {
      switch (block.kind) {
        case 'dedication': return '{{回向名单}}'
        case 'note': return `※ ${block.text}`
        case 'list': return block.items.join('\n')
        default: return block.label && block.kind === 'text' ? `${block.label}\n${block.text}` : block.text
      }
    })
    .join('\n\n')
}

export function applyOverride(section: DingkeSection, override?: DingkeSectionOverride): DingkeSection {
  if (!override) return section
  return {
    ...section,
    title: override.title ?? section.title,
    subtitle: override.subtitle ?? section.subtitle,
    slide: {
      ...section.slide,
      headline: override.headline ?? section.slide.headline,
      lines: override.slideLines ?? section.slide.lines,
    },
    blocks: override.body ? parseBody(override.body) : section.blocks,
  }
}

export function resolveSections(overrides: DingkeOverrides): DingkeSection[] {
  return DEFAULT_DINGKE_SECTIONS.map(section => applyOverride(section, overrides[section.id]))
}
