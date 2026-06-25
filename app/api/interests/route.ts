import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type FeedItem = {
  title: string;
  link: string;
  publishedAt: string;
  topic: string;
};

const fallbackInterests = [
  {
    title: "Agentic AI for financial services",
    detail: "Martin may be watching how autonomous workflows can improve banking operations, advisory productivity, and risk controls.",
    date: "Today",
    sourceUrl: "",
  },
  {
    title: "SpaceX and reusable launch economics",
    detail: "Martin may see reusable launch systems as a practical case study in compounding engineering advantage.",
    date: "Today",
    sourceUrl: "",
  },
  {
    title: "Quantum computing progress",
    detail: "Martin may be tracking whether quantum hardware is moving from scientific promise toward commercially useful reliability.",
    date: "Today",
    sourceUrl: "",
  },
];

const topicFeeds = [
  {
    topic: "AI",
    url: "https://news.google.com/rss/search?q=artificial%20intelligence%20technology%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",
  },
  {
    topic: "SpaceX",
    url: "https://news.google.com/rss/search?q=SpaceX%20Starship%20launch%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",
  },
  {
    topic: "Stock Investment",
    url: "https://news.google.com/rss/search?q=stock%20market%20investment%20AI%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",
  },
  {
    topic: "Quantum Computing",
    url: "https://news.google.com/rss/search?q=quantum%20computing%20technology%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",
  },
  {
    topic: "Robotics",
    url: "https://news.google.com/rss/search?q=robotics%20humanoid%20automation%20when%3A7d&hl=en-US&gl=US&ceid=US%3Aen",
  },
];

function decodeEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function getTagValue(itemXml: string, tag: string) {
  const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function normalizeTitle(title: string) {
  return title
    .replace(/\s+-\s+[^-]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFeed(xml: string, topic: string): FeedItem[] {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
    .map((match) => {
      const itemXml = match[1];
      return {
        title: normalizeTitle(getTagValue(itemXml, "title")),
        link: getTagValue(itemXml, "link"),
        publishedAt: getTagValue(itemXml, "pubDate"),
        topic,
      };
    })
    .filter((item) => item.title.length > 0);
}

function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function getHongKongDaySeed() {
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return dayKey.split("-").reduce((total, part) => total * 31 + Number(part), 17);
}

function shuffleDaily<T>(items: T[]) {
  const random = seededRandom(getHongKongDaySeed());
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function buildTakeaway(item: FeedItem) {
  const topicTakeaways: Record<string, string> = {
    AI: "Martin may be watching how this shifts practical productivity, governance, and competitive advantage.",
    SpaceX: "Martin may read this as another signal of how ambitious engineering programs compound through rapid iteration.",
    "Stock Investment": "Martin may treat this as a reminder to separate durable business quality from short-term market excitement.",
    "Quantum Computing": "Martin may be tracking whether the field is moving closer to real commercial workloads.",
    Robotics: "Martin may see this as part of the broader move from software-only automation into physical-world execution.",
  };

  return topicTakeaways[item.topic] ?? "Martin may be tracking what this means for technology, markets, and long-term execution.";
}

async function loadFeedItems() {
  const results = await Promise.allSettled(
    topicFeeds.map(async (feed) => {
      const response = await fetch(feed.url, {
        headers: {
          "user-agent": "Martin Virtual Twin interest crawler",
        },
        next: {
          revalidate: 60 * 60 * 24,
        },
      });

      if (!response.ok) {
        return [];
      }

      return parseFeed(await response.text(), feed.topic);
    })
  );

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

export async function GET() {
  const items = await loadFeedItems();
  const seenTitles = new Set<string>();
  const dailyRandom = seededRandom(getHongKongDaySeed() + 101);
  const dailyLimit = 3 + Math.floor(dailyRandom() * 3);
  const uniqueItems = shuffleDaily(items)
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seenTitles.has(key)) {
        return false;
      }
      seenTitles.add(key);
      return true;
    })
    .slice(0, dailyLimit);

  const interests = uniqueItems.map((item) => ({
    title: item.title,
    detail: buildTakeaway(item),
    date: item.topic,
    sourceUrl: item.link,
  }));

  return NextResponse.json(
    {
      generated_at: new Date().toISOString(),
      interests: interests.length >= 3 ? interests : fallbackInterests,
    },
    {
      headers: {
        "cache-control": "s-maxage=86400, stale-while-revalidate=43200",
      },
    }
  );
}
