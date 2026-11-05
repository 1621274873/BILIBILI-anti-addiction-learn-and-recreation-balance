import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyContext,
  normalizeTags,
  summarizeTopic
} from "../src/shared/model.js";
import { formatDuration } from "../src/shared/format.js";
import {
  buildUsageSnapshot,
  shouldIssueRecreationWarning
} from "../src/shared/usage.js";

test("normalizes, trims, and deduplicates tags", () => {
  assert.deepEqual(
    normalizeTags([" #Python ", "python", "", 12, "  数据分析  "]),
    ["Python", "数据分析"]
  );
});

test("classifies programming tags as education", () => {
  const result = classifyContext({
    tags: ["Python", "编程入门", "教程", "数据分析"]
  });

  assert.equal(result.category, "education");
  assert.ok(result.confidence > 0.5);
});

test("classifies gaming and entertainment tags as recreation", () => {
  const result = classifyContext({
    tags: ["英雄联盟", "游戏实况", "搞笑"]
  });

  assert.equal(result.category, "recreation");
});

test("uses the Bilibili category as a classification hint", () => {
  const result = classifyContext({
    tags: [],
    tname: "科技"
  });

  assert.equal(result.category, "education");
});

test("defaults uncertain videos to recreation", () => {
  const result = classifyContext({
    tags: ["生活记录"],
    tname: "生活"
  });

  assert.equal(result.category, "recreation");
  assert.ok(result.confidence >= 0.25);
});

test("bangumi defaults to recreation", () => {
  const result = classifyContext({
    kind: "bangumi",
    tags: [],
    tname: ""
  });

  assert.equal(result.category, "recreation");
});

test("summarizes a topic from the most specific useful tags", () => {
  const topic = summarizeTopic(
    ["哔哩哔哩", "原创", "Python", "编程入门", "教程"],
    "A video"
  );

  assert.equal(topic, "Python / 编程入门 / 教程");
});

test("falls back to the cleaned title when tags are generic", () => {
  const topic = summarizeTopic(
    ["知识", "学习", "哔哩哔哩"],
    "How systems work_哔哩哔哩_bilibili"
  );

  assert.equal(topic, "How systems work");
});

test("formats daily durations for the popup", () => {
  assert.equal(formatDuration(0), "0s");
  assert.equal(formatDuration(61), "1m");
  assert.equal(formatDuration(3661), "1h 01m");
});

test("warns when a lowered limit is already exceeded", () => {
  assert.equal(
    shouldIssueRecreationWarning({
      recreationSeconds: 6300,
      limitMinutes: 90,
      warningIssued: false
    }),
    true
  );
});

test("does not issue the same warning twice", () => {
  assert.equal(
    shouldIssueRecreationWarning({
      recreationSeconds: 6300,
      limitMinutes: 90,
      warningIssued: true
    }),
    false
  );
});

test("builds a usage snapshot for the daily limit", () => {
  const usage = buildUsageSnapshot({
    day: {
      educationSeconds: 1200,
      recreationSeconds: 3600,
      warningIssued: false
    },
    limitMinutes: 90,
    dateKey: "2026-10-24"
  });

  assert.equal(usage.limitSeconds, 5400);
  assert.equal(usage.remainingSeconds, 1800);
  assert.equal(usage.overLimit, false);
});
