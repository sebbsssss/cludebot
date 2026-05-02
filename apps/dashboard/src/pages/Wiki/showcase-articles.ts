// Curated wiki article bodies for /showcase/wiki — written from the
// non-technical user's perspective. Each entry reads like a friend's notebook
// summarising what they've said about a topic, with the actual quotes
// embedded as evidence.

import type { ProseBlock, SectionKind } from './use-topic-article';

interface CuratedSection {
  id: string;
  title: string;
  kind?: SectionKind;
  prose: ProseBlock[];
}

export interface CuratedArticle {
  topicId: string;
  sections: CuratedSection[];
}

export const SHOWCASE_ARTICLES: CuratedArticle[] = [
  {
    topicId: 'sleep',
    sections: [
      {
        id: 'whats-going-on',
        title: "What's going on",
        kind: 'overview',
        prose: [
          { kind: 'p', text:
            "Sleep has been the dominant theme of your morning notes for the past month. The pattern is consistent: when you keep the **10pm phone cutoff**, the rest of the week is dramatically better. When you don't, you're up until 1am and the next morning is a wreck." },
          { kind: 'p', text:
            "You've named the cutoff three times as the single biggest lever. The friction isn't knowing what to do — it's the actual moment of putting the phone down." },
        ],
      },
      {
        id: 'whats-working',
        title: "What's working",
        kind: 'highlight',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0001' }, // 10pm cutoff transformative
          { kind: 'reframe', memoryHash: 'clude-0003' }, // consistent bedtime > total hours
          { kind: 'p', text:
            "Two things are now well-supported by your own observations: a fixed bedtime is more important than how many hours you log, and the phone cutoff is the highest-leverage habit in your life right now. You don't need more data on either." },
        ],
      },
      {
        id: 'whats-not',
        title: "What hasn't",
        kind: 'concern',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0000' }, // bad night, scrolling
          { kind: 'reframe', memoryHash: 'clude-0002' }, // magnesium tried, ambivalent
          { kind: 'callout', tone: 'note', text:
            "Magnesium is an inconclusive experiment. You tried it once, didn't like the grogginess, and haven't returned to it. Probably worth dropping from the active list — keep it in the back pocket." },
        ],
      },
      {
        id: 'open',
        title: 'Open question',
        kind: 'question',
        prose: [
          { kind: 'callout', tone: 'question', text:
            "What's the actual mechanism for the 10pm cutoff? You've named it as the lever three times but the implementation keeps slipping. Maybe the phone needs to physically leave the bedroom, not just be face-down." },
        ],
      },
    ],
  },

  {
    topicId: 'sarahs-wedding',
    sections: [
      {
        id: 'the-basics',
        title: 'The basics',
        kind: 'overview',
        prose: [
          { kind: 'p', text:
            "**May 24 in Healdsburg.** Outdoor ceremony. You're driving up Friday morning and staying through Sunday." },
          { kind: 'p', text:
            "Pat is confirmed as your +1. Sarah needs the RSVP and the meal choice (chicken or fish) by Friday — that's the most time-sensitive thing on the list." },
        ],
      },
      {
        id: 'logistics',
        title: 'Logistics',
        kind: 'action',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0005' }, // hotel decision pending
          { kind: 'p', text:
            "The hotel decision is still open. The Inn at the River keeps you with the bridal party but is roughly twice the price. Wine Country Inn saves money but means a 15-minute drive each way and missing the after-party hangout. No wrong answer; depends on whether the bridal-party time matters more than the savings." },
        ],
      },
      {
        id: 'gift',
        title: 'Gift',
        kind: 'decision',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0006' }, // heath ceramic platter
          { kind: 'p', text:
            "Decided. You and Pat had been talking about that platter for months anyway, so it doubles as something you've genuinely wanted to gift. Order it this week — the registry was filling up fast last time you checked." },
        ],
      },
      {
        id: 'open',
        title: "Still to figure out",
        kind: 'action',
        prose: [
          { kind: 'list', items: [
            "RSVP +1 and meal choice — by Friday",
            "Book the hotel (Inn at the River vs Wine Country Inn)",
            "Order the Heath platter",
            "Decide on the navy suit vs the linen — you'd flagged that Healdsburg in May gets hot",
          ] },
        ],
      },
    ],
  },

  {
    topicId: 'apartment-search',
    sections: [
      {
        id: 'what-youre-looking-for',
        title: "What you're looking for",
        kind: 'overview',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0009' }, // non-negotiables
          { kind: 'p', text:
            "You've been remarkably consistent on this list — natural light, in-unit washer/dryer, walkable to a coffee shop. Anything that doesn't have all three has been a quick no. Parking and ceiling height keep coming up as things people *expect* you to care about, but you don't, and you've been right not to." },
        ],
      },
      {
        id: 'recent-viewings',
        title: 'Recent viewings',
        kind: 'overview',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0008' }, // bernal heights
          { kind: 'reframe', memoryHash: 'clude-0010' }, // noe valley rented out
          { kind: 'p', text:
            "Pattern from the last few weeks: the good ones rent fast, often before you can see them. The Noe Valley one was the third time this happened. Worth being more aggressive about same-day viewings — it's costing you good options." },
        ],
      },
      {
        id: 'open',
        title: 'Open questions',
        kind: 'question',
        prose: [
          { kind: 'callout', tone: 'question', text:
            "Should you call the Bernal Heights landlord back, or trust the slow-response signal? Slow-responding landlords during showing tend to stay slow once you're a tenant. That's a real cost, even with the great light." },
        ],
      },
    ],
  },

  {
    topicId: 'cooking',
    sections: [
      {
        id: 'in-the-rotation',
        title: 'In the rotation',
        kind: 'highlight',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0012' }, // za'atar chicken thighs
          { kind: 'p', text:
            "Three times in a month means it's officially in the rotation. You've documented the technique well enough that next time you make it, the crispy skin part shouldn't be guesswork." },
        ],
      },
      {
        id: 'meal-prep',
        title: 'Meal prep',
        kind: 'highlight',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0013' }, // sunday meal prep formula
          { kind: 'p', text:
            "This is the only meal prep approach that's actually stuck. It's worth saying out loud that you've tried five other systems and abandoned all of them. The reason this one works is that you don't have to *plan dinners* — you just assemble from what's already cooked." },
        ],
      },
      {
        id: 'projects',
        title: 'Long-running projects',
        kind: 'overview',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0014' }, // sourdough, gerald the starter
          { kind: 'callout', tone: 'note', text:
            "Sourdough is in the 'getting better' phase. Four loaves in, you're past the everything-is-flat stage. Gerald the starter has survived a month, which is longer than any previous starter you've kept." },
        ],
      },
    ],
  },

  {
    topicId: 'reading',
    sections: [
      {
        id: 'recently-finished',
        title: 'Recently finished',
        kind: 'overview',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0015' }, // ivan ilyich
          { kind: 'p', text:
            "Ivan Ilyich is going to keep coming back to you. The line you flagged — *we are all dying, but we don't believe it* — is the kind of thing that re-reads itself in your head when you're not expecting it. Worth re-reading the whole novella in a year and seeing what's changed." },
        ],
      },
      {
        id: 'currently',
        title: 'Currently reading',
        kind: 'overview',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0016' }, // master and his emissary
          { kind: 'p', text:
            "McGilchrist is dense. You're halfway through and the thesis is starting to land — it's not really a book about brain hemispheres, it's an argument about how we organise attention. Keep going. The last third is supposedly where the civilisation argument actually lands." },
        ],
      },
      {
        id: 'didnt-stick',
        title: "Didn't stick",
        kind: 'concern',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0017' }, // didn't finish piranesi
          { kind: 'callout', tone: 'note', text:
            "Not every book needs to land. Three chapters in is enough to know. Don't let the 'everyone says it's a masterpiece' thing override your own read." },
        ],
      },
    ],
  },

  {
    topicId: 'moms-surgery',
    sections: [
      {
        id: 'the-plan',
        title: 'The plan',
        kind: 'action',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0018' }, // surgery date, coverage split
          { kind: 'p', text:
            "Your sister has the first three days. You have days four through seven. Flight needs to be booked tonight — you flagged it and haven't done it yet. Set a reminder for after dinner if it's still open." },
        ],
      },
      {
        id: 'what-mom-needs',
        title: 'What mom actually needs',
        kind: 'overview',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0019' }, // mom worried about being a burden
          { kind: 'p', text:
            "The thing she's most worried about isn't the surgery — it's being a burden after. That changes what 'helping' looks like during your week. It probably means doing less, asking what she wants, and not making everything visible labour." },
        ],
      },
      {
        id: 'before-going',
        title: 'Before you go',
        kind: 'action',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0020' }, // pre-departure checklist
          { kind: 'list', items: [
            'Groceries delivered to her place the day before',
            'Airport ride sorted (uber will not work — she gets carsick)',
            "Work knows you're OOO",
            'Phone charger packed',
            'The soft pillow she likes',
          ] },
        ],
      },
    ],
  },

  {
    topicId: 'career',
    sections: [
      {
        id: 'what-you-keep-saying',
        title: 'What you keep saying',
        kind: 'overview',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0021' }, // don't want to be a manager
          { kind: 'p', text:
            "This isn't a passing thought — it's a recurring conviction. The agent has heard it from you in slightly different forms across multiple weeks. The default path you're on is one you don't actually want, and naming that out loud is the first useful thing." },
        ],
      },
      {
        id: 'whats-actually-possible',
        title: "What's actually possible",
        kind: 'highlight',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0022' }, // maya's advice on staff path
          { kind: 'reframe', memoryHash: 'clude-0023' }, // talk at offsite felt great
          { kind: 'p', text:
            "Two pieces of evidence are pointing the same direction. Maya did the staff-without-management transition by being LOUD about her work. And the talk you gave felt like the kind of work you want more of. Both suggest the path forward is **visibility of the work you already do well**, not a new kind of work." },
        ],
      },
      {
        id: 'open',
        title: 'The honest question',
        kind: 'question',
        prose: [
          { kind: 'callout', tone: 'question', text:
            "If giving talks feels great and you keep saying that, why don't you give more talks? What's the actual blocker? It's worth answering before the next offsite goes by." },
        ],
      },
    ],
  },

  {
    topicId: 'money',
    sections: [
      {
        id: 'the-system',
        title: 'The system',
        kind: 'decision',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0024' }, // 20/10/rest auto-allocation
          { kind: 'p', text:
            "This is the first time you've put a system in place rather than making the decision every paycheck. The point of the system is that it removes the decision — you don't have to be disciplined about it month-to-month, you just have to leave it alone." },
        ],
      },
      {
        id: 'big-purchases',
        title: 'Big purchases',
        kind: 'concern',
        prose: [
          { kind: 'reframe', memoryHash: 'clude-0025' }, // mac was 4 months of savings
          { kind: 'callout', tone: 'note', text:
            "The Mac was the right call but it cost real time on the [[apartment-search|apartment]] timeline. Worth being honest about that tradeoff for the next big purchase, instead of pretending the categories are independent." },
        ],
      },
    ],
  },
];

export function getCuratedArticle(topicId: string): CuratedArticle | null {
  return SHOWCASE_ARTICLES.find((a) => a.topicId === topicId) ?? null;
}

// Walk every curated article and collect: for each topic that appears as a
// [[wikilink target]], the list of articles that reference it (with a snippet).
export interface CuratedBacklink {
  fromTopicId: string;
  snippet: string;
}

export function findCuratedBacklinks(targetTopicId: string): CuratedBacklink[] {
  const out: CuratedBacklink[] = [];
  for (const article of SHOWCASE_ARTICLES) {
    if (article.topicId === targetTopicId) continue;
    for (const section of article.sections) {
      for (const block of section.prose) {
        if (block.kind === 'p' || block.kind === 'callout') {
          if (referencesTopic(block.text, targetTopicId)) {
            out.push({
              fromTopicId: article.topicId,
              snippet: snippetAround(block.text, targetTopicId),
            });
            break;
          }
        } else if (block.kind === 'list') {
          for (const item of block.items) {
            if (referencesTopic(item, targetTopicId)) {
              out.push({
                fromTopicId: article.topicId,
                snippet: snippetAround(item, targetTopicId),
              });
              break;
            }
          }
        }
      }
    }
  }
  return out;
}

function referencesTopic(text: string, topicId: string): boolean {
  return new RegExp(`\\[\\[${topicId}(?:\\|[^\\]]+)?\\]\\]`).test(text);
}

function snippetAround(text: string, topicId: string): string {
  const plain = text
    .replace(/\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, (_m, slug, label) => label ?? slug)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');

  const lower = plain.toLowerCase();
  const idx = lower.indexOf(topicId.replace(/-/g, ' ')) >= 0
    ? lower.indexOf(topicId.replace(/-/g, ' '))
    : 0;
  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + 100);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < plain.length ? '…' : '';
  return `${prefix}${plain.slice(start, end).trim()}${suffix}`;
}
