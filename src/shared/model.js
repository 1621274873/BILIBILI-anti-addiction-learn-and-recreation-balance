const GENERIC_TAGS = new Set([
  "bilibili",
  "哔哩哔哩",
  "原创",
  "自制",
  "视频",
  "热门",
  "推荐",
  "投稿",
  "转载",
  "官方",
  "高清",
  "合集",
  "连载",
  "活动"
]);

const LOW_SIGNAL_TOPIC_TAGS = new Set([
  "知识",
  "学习",
  "教育",
  "娱乐",
  "资讯",
  "生活",
  "日常"
]);

const EDUCATION_HINTS = [
  "教程",
  "课程",
  "学习",
  "教育",
  "知识",
  "科普",
  "公开课",
  "网课",
  "考研",
  "高考",
  "考试",
  "备考",
  "笔记",
  "干货",
  "讲解",
  "教学",
  "入门",
  "实战",
  "实验",
  "编程",
  "代码",
  "算法",
  "数据结构",
  "计算机",
  "软件",
  "开发",
  "前端",
  "后端",
  "数据库",
  "人工智能",
  "机器学习",
  "深度学习",
  "数学",
  "物理",
  "化学",
  "生物",
  "医学",
  "经济",
  "金融",
  "法律",
  "历史",
  "哲学",
  "英语",
  "日语",
  "设计",
  "摄影",
  "剪辑",
  "python",
  "javascript",
  "typescript",
  "java",
  "rust",
  "react",
  "linux",
  "sql",
  "ai",
  "tutorial",
  "course",
  "learn",
  "programming",
  "science",
  "documentary"
];

const RECREATION_HINTS = [
  "游戏",
  "电竞",
  "搞笑",
  "娱乐",
  "鬼畜",
  "音乐",
  "歌曲",
  "翻唱",
  "mv",
  "舞蹈",
  "动画",
  "番剧",
  "影视",
  "电影",
  "电视剧",
  "综艺",
  "vlog",
  "美食",
  "吃播",
  "旅行",
  "手工",
  "开箱",
  "挑战",
  "直播",
  "搞笑视频",
  "游戏实况",
  "game",
  "gaming",
  "music",
  "anime",
  "movie",
  "film",
  "variety",
  "comedy"
];

const CATEGORY_HINTS = {
  知识: "education",
  科技: "education",
  教育: "education",
  课程: "education",
  纪录片: "education",
  游戏: "recreation",
  娱乐: "recreation",
  音乐: "recreation",
  舞蹈: "recreation",
  动画: "recreation",
  番剧: "recreation",
  影视: "recreation",
  电影: "recreation",
  综艺: "recreation",
  生活: "recreation",
  美食: "recreation",
  鬼畜: "recreation"
};

const VALID_CATEGORIES = new Set(["education", "recreation"]);

function asClock(value) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const value of tags) {
    if (typeof value !== "string") {
      continue;
    }

    const tag = value
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^#+\s*/, "")
      .slice(0, 40);
    const key = tag.toLocaleLowerCase();

    if (!tag || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(tag);
  }

  return normalized.slice(0, 30);
}

function scoreHints(tags, hints) {
  let score = 0;

  for (const tag of tags) {
    const lowerTag = tag.toLocaleLowerCase();

    for (const hint of hints) {
      if (lowerTag.includes(hint)) {
        score += hint.length >= 4 ? 3 : 2;
      }
    }
  }

  return score;
}

function scoreCategoryHint(tname) {
  const categoryScore = {
    education: 0,
    recreation: 0
  };
  const normalizedName = String(tname ?? "").toLocaleLowerCase();

  for (const [hint, category] of Object.entries(CATEGORY_HINTS)) {
    if (normalizedName.includes(hint)) {
      categoryScore[category] += 3;
    }
  }

  return categoryScore;
}

export function classifyContext(context = {}) {
  const tags = normalizeTags(context.tags);
  const categoryScore = {
    education: scoreHints(tags, EDUCATION_HINTS),
    recreation: scoreHints(tags, RECREATION_HINTS)
  };
  const hintScore = scoreCategoryHint(context.tname);

  categoryScore.education += hintScore.education;
  categoryScore.recreation += hintScore.recreation;

  if (context.kind === "bangumi") {
    categoryScore.recreation += 4;
  }

  const category =
    categoryScore.education > categoryScore.recreation
      ? "education"
      : "recreation";
  const topScore = Math.max(
    categoryScore.education,
    categoryScore.recreation
  );
  const margin = Math.abs(
    categoryScore.education - categoryScore.recreation
  );
  const confidence =
    topScore === 0 ? 0.25 : Math.min(0.96, 0.55 + margin / 24);

  return {
    category,
    confidence: Number(confidence.toFixed(2)),
    scores: categoryScore
  };
}

function cleanTitle(title) {
  return String(title ?? "")
    .replace(/\s*[-_|]\s*哔哩哔哩.*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeTopic(tags, title = "") {
  const normalized = normalizeTags(tags);
  const usefulTags = normalized.filter((tag) => {
    const lowerTag = tag.toLocaleLowerCase();
    return (
      !GENERIC_TAGS.has(lowerTag) && !LOW_SIGNAL_TOPIC_TAGS.has(lowerTag)
    );
  });
  const pool = [...usefulTags].sort(
    (first, second) => second.length - first.length
  );
  const chosen = [];

  for (const tag of pool) {
    const lowerTag = tag.toLocaleLowerCase();
    const alreadyCovered = chosen.some((current) => {
      const lowerCurrent = current.toLocaleLowerCase();
      return lowerCurrent.includes(lowerTag) || lowerTag.includes(lowerCurrent);
    });

    if (!alreadyCovered) {
      chosen.push(tag);
    }

    if (chosen.length === 3) {
      break;
    }
  }

  if (chosen.length > 0) {
    return chosen.join(" / ");
  }

  const fallback = cleanTitle(title);
  return fallback ? fallback.slice(0, 60) : "Topic not detected";
}

export function isCategory(value) {
  return VALID_CATEGORIES.has(value);
}

export function normalizeSeconds(value) {
  return Math.round(asClock(Number(value)));
}
