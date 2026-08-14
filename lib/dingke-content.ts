import type { DingkeSection } from '@/types'

/**
 * The 定课 script, transcribed from GPGB-同喜定课模板1-18字+慈经 v1.0-20251212.pptx.
 *
 * The deck itself is unusable over Zoom from a phone: several of its lines
 * (三称本师圣号, 大乘皈敬颂) are pictures of calligraphy rather than text, the
 * 主持人白 cues sit in tiny print at the slide edge, and the two chant tracks are
 * embedded audio that only fires in PowerPoint's own slideshow mode. This module
 * carries the same content as data instead: `slide` is what the room reads,
 * `blocks` is what the host reads, and the audio is served from R2 (see
 * DINGKE_AUDIO) so a phone browser can play it.
 *
 * Section ids are stable — per-class overrides in R2 key off them, so renaming
 * one silently drops that class's edits.
 */

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://greatpath-show-assets.vibeuncle.com'

/** Both tracks are the ones extracted from the deck, uploaded once to R2. */
export const DINGKE_AUDIO = {
  opening: {
    src: `${R2_BASE}/shared/dingke/opening.mp3`,
    label: '开场音乐',
    durationSec: 391,
  },
  cijing: {
    src: `${R2_BASE}/shared/dingke/cijing.mp3`,
    label: '《慈经》',
    durationSec: 712,
  },
} as const

export const DEFAULT_DINGKE_SECTIONS: DingkeSection[] = [
  // 开场 runs music first, then puts the four 愿 on screen to be read together —
  // hence `audioFirst`. It is split from 菩提导航 below so the host clicks through
  // the sequence rather than reading it off one crowded slide.
  {
    id: 'opening',
    title: '开场',
    subtitle: '开场音乐 · 共同愿景',
    slide: {
      kicker: '定课开始前',
      lines: ['让企业家走向觉醒', '让经营成为修行', '让商场成为道场', '让商业利益众生'],
      chant: true,
    },
    blocks: [
      { kind: 'note', text: '等候师兄进入会议室时，可先播放「活动展示」；人到齐后再开始。' },
      { kind: 'cue', text: '主持人白：请大家收摄身心，我们一起念诵——' },
      { kind: 'chant', text: '让企业家走向觉醒\n让经营成为修行\n让商场成为道场\n让商业利益众生' },
    ],
    audio: DINGKE_AUDIO.opening,
    audioFirst: true,
  },
  {
    id: 'prepare',
    title: '菩提导航',
    subtitle: '五处用心 · 修学管理',
    slide: {
      headline: '菩提导航',
      lines: ['开始修学管理', '五处用心 —— 慈经 —— 修学管理'],
    },
    blocks: [
      { kind: 'cue', text: '主持人白：请大家打开「菩提导航」APP，进入「五处用心」——「慈经」——「修学管理」，做好「态度」与「慈经修习」的管理，我们正式进入定课流程。' },
    ],
  },
  {
    id: 'homage',
    title: '三称本师圣号',
    subtitle: '大乘皈敬颂',
    slide: {
      kicker: '合掌',
      headline: '南无本师释迦牟尼佛',
      lines: ['诸佛正法贤圣僧', '直至菩提永皈依', '我以所修诸善根', '为利有情愿成佛'],
      chant: true,
    },
    blocks: [
      { kind: 'cue', text: '主持人白：大众合掌，三称本师圣号。' },
      { kind: 'chant', label: '三称', text: '南无本师释迦牟尼佛（三称）' },
      { kind: 'cue', text: '主持人白：大众一起念诵大乘皈敬颂。' },
      { kind: 'chant', label: '大乘皈敬颂', text: '诸佛正法贤圣僧\n直至菩提永皈依\n我以所修诸善根\n为利有情愿成佛' },
    ],
  },
  {
    id: 'attitude',
    title: '修学态度',
    subtitle: '十八字方针',
    slide: {
      lines: [
        '# 十八字方针',
        '真诚、认真、老实，',
        '理解、接受、运用，',
        '观念、心态、品质。',
        '# 修学态度',
        '真诚、认真、老实',
      ],
      chant: true,
    },
    blocks: [
      { kind: 'cue', text: '主持人白：大众一起至心念诵十八字方针。' },
      { kind: 'chant', label: '十八字方针', text: '真诚、认真、老实，\n理解、接受、运用，\n观念、心态、品质。' },
      {
        kind: 'text',
        label: '真 诚',
        text: '以佛法为镜，真诚面对生命存在的过患，认识到自己是充满迷惑烦恼的凡夫，是轮回的重病患者，勇于自我检讨，不自欺，不逃避。唯有看清这些问题，才能本着治病的心态修学。否则，学佛可能只是生活中的一种点缀。我们不仅要真诚面对自己，还要真诚地面对法，面对法师，就像急切期盼康复的患者那样，把法当作疗病的良药，把法师当作救命的良医。',
      },
      {
        kind: 'text',
        label: '认 真',
        text: '用心投入修学，严格要求自己，按照《略论》听闻轨则的要求，扎实、深入地学好每次课程的内容，反复闻思，认真理解法义，让佛法进入心相续中，完成生命的自我改造。',
      },
      {
        kind: 'text',
        label: '老 实',
        text: '认同静心学堂模式后，要老老实实按照模式，一门深入，不要被混乱的凡夫心左右，到处攀缘。如果不能珍惜法缘，安心学习，是难有受用的。',
      },
    ],
  },
  {
    id: 'method',
    title: '修学方法',
    subtitle: '八步三禅 · 十六字窍诀',
    slide: {
      kicker: '修学方法',
      headline: '八步三禅',
      // The eight steps are eight full sentences — the deck projects them at body
      // size too, so this slide is not `chant`; the 窍诀 that follows carries the
      // emphasis in the script instead.
      lines: [
        '# 八步骤',
        '第一步：学习书本和音像内容，了解每句话的含义。',
        '第二步：正确理解每个段落、章节的法义。',
        '第三步：带着问题学习，知道每个章节说明什么问题，经论中又以什么方式说明。',
        '第四步：把经论所说的问题和现实人生相联系，建立正确的认识和人生观，并安住在这种认识和观念中。',
        '第五步：学会用佛法智慧（正见）重新审视人生，指导人生，解决现实问题。',
        '第六步：摆脱不良串习，建立正向心理。安住于正向心理，完成心态的改变。',
        '第七步：思维不良心态的过患，依正见观察思考，摆脱不良心态。',
        '第八步：思维正向心态的利益，依正见深入思考。不断熟悉和重复正向心态，完成生命品质的改变。',
        '# 十六字窍诀',
        '树立正见，认清真相，摆脱错误，重复正确。',
      ],
    },
    // 八步骤 before 十六字窍诀: the 窍诀 is the summary the room chants once the
    // eight steps have been read through.
    blocks: [
      { kind: 'note', text: '三禅：正念禅修 · 利他禅修（贯穿八步骤）' },
      {
        kind: 'list',
        label: '八步骤',
        items: [
          '第一步：学习书本和音像内容，了解每句话的含义。',
          '第二步：正确理解每个段落、章节的法义。',
          '第三步：带着问题学习，知道每个章节说明什么问题，经论中又以什么方式说明。',
          '第四步：把经论所说的问题和现实人生相联系，建立正确的认识和人生观，并安住在这种认识和观念中。',
          '第五步：学会用佛法智慧（正见）重新审视人生，指导人生，解决现实问题。',
          '第六步：摆脱不良串习，建立正向心理。安住于正向心理，完成心态的改变。',
          '第七步：思维不良心态的过患，依正见观察思考，摆脱不良心态。',
          '第八步：思维正向心态的利益，依正见深入思考。不断熟悉和重复正向心态，完成生命品质的改变。',
        ],
      },
      { kind: 'cue', text: '主持人白：大众一起念诵十六字窍诀。' },
      { kind: 'chant', label: '十六字窍诀', text: '树立正见，认清真相，摆脱错误，重复正确。' },
    ],
  },
  {
    id: 'effect',
    title: '修学效果',
    slide: {
      kicker: '修学效果',
      headline: '观念 · 心态 · 生命品质',
      lines: ['落实正确的态度和方法后，', '我们将从「观念、心态、生命品质」发生改变，', '这是水到渠成的。'],
    },
    blocks: [
      {
        kind: 'text',
        text: '凡夫的生命是一大堆错误观念和混乱情绪的综合体。错误观念导致贪嗔痴烦恼，形成凡夫品质；正确观念带来正向心态，成就圣贤品质。通过修学，我们对世界和人生的固有观念将逐渐被智慧替代，解除由错误观念导致的烦恼，走出迷妄的轮回系统，成就佛菩萨的生命品质。',
      },
      { kind: 'text', text: '落实正确的态度和方法后，我们将从「观念、心态、生命品质」发生改变，这是水到渠成的。' },
    ],
  },
  {
    id: 'cijing',
    title: '《慈经》禅修',
    subtitle: '音频含止静，播完即可',
    slide: {
      kicker: '禅修',
      headline: '《慈经》',
      lines: ['请大家端身正坐，收摄身心，恭听《慈经》'],
    },
    blocks: [
      { kind: 'cue', text: '主持人缓缓念诵禅修引导：' },
      { kind: 'text', text: '请大家端身正坐，收摄身心，恭听《慈经》。' },
      { kind: 'text', text: '把《慈经》的每句话，转化成自己发自内心的决定和由衷的祝愿。' },
      { kind: 'text', text: '同时，通过观想，把《慈经》的每一句话转化成阳光，观想我们的祝愿如冬日的暖阳般遍照一切，驱散世间的敌意和危险，驱散众生精神和身体的痛苦，使他们的每个细胞得到能量，快乐无忧。' },
      { kind: 'note', text: '音频末段已包含约 3 分钟的止静，播完即可进入下一环节，无需另行计时。' },
    ],
    audio: DINGKE_AUDIO.cijing,
  },
  {
    id: 'fourimmeasurables',
    title: '四无量心',
    slide: {
      kicker: '合掌 · 至诚修习',
      headline: '四无量心',
      lines: [
        '愿诸众生永具安乐及安乐因',
        '愿诸众生永离众苦及众苦因',
        '愿诸众生永具无苦之乐身心愉悦',
        '愿诸众生远离贪嗔之心住平等舍',
      ],
      chant: true,
    },
    blocks: [
      { kind: 'cue', text: '轮值主持、组长或辅助员白：在座下我们要不断践行慈心，把想法变成做法，把祝愿变成行动。' },
      { kind: 'cue', text: '大众合掌，至诚修习四无量心。' },
      { kind: 'chant', label: '四无量心', text: '愿诸众生永具安乐及安乐因\n愿诸众生永离众苦及众苦因\n愿诸众生永具无苦之乐身心愉悦\n愿诸众生远离贪嗔之心住平等舍' },
    ],
  },
  {
    id: 'dedication',
    title: '回向',
    subtitle: '完成菩提导航打卡',
    slide: {
      kicker: '大众至诚回向',
      headline: '回向偈',
      lines: ['愿以此功德', '普及于一切', '我等与众生', '皆共成佛道'],
      chant: true,
    },
    blocks: [
      { kind: 'cue', text: '轮值主持、组长或辅助员白：今天定课圆满，我们将定课功德回向给——' },
      { kind: 'dedication' },
      { kind: 'cue', text: '大众至诚回向：' },
      { kind: 'chant', label: '回向偈', text: '愿以此功德\n普及于一切\n我等与众生\n皆共成佛道' },
      { kind: 'cue', text: '主持人白：请大家打开「菩提导航」APP——「五处用心」——「定课」，做好本次共修打卡，并阅读「心理提示」，完成「心理积累」、「心理检测」。' },
    ],
    dedication: true,
  },
]

export function getDefaultSection(id: string): DingkeSection | undefined {
  return DEFAULT_DINGKE_SECTIONS.find(s => s.id === id)
}
