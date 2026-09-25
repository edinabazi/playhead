import { describe, expect, it } from "vitest";
import { activeLyricIndex, parseLyrics } from "../lyrics";

describe("LRC parsing", () => {
  it("handles fractions, repeated timestamps, offsets, translation lines and instrumental gaps", () => {
    const lyrics = parseLyrics(
      "\uFEFF[ar:Artist]\r\n[00:05.25][00:15.250]A line\r\n[00:05.25]Translation\r\n[00:09]\r\n[offset:+250]",
    );
    expect(lyrics).toEqual({
      synced: true,
      lines: [
        { time: 5, text: "A line\nTranslation" },
        { time: 8.75, text: "" },
        { time: 15, text: "A line" },
      ],
    });
  });
  it("keeps plain lyrics and stanza breaks, excluding metadata and malformed time tags", () => {
    expect(parseLyrics("[ti:Title]\nFirst line\n\nSecond line")).toEqual({
      synced: false,
      lines: [
        { time: null, text: "First line" },
        { time: null, text: "" },
        { time: null, text: "Second line" },
      ],
    });
    expect(parseLyrics("[00:99.00]bad\n[offset:200]")).toBeNull();
    expect(parseLyrics("  ")).toBeNull();
  });
  it("sorts timestamps, clamps negative adjusted times and strips enhanced word timing", () => {
    expect(
      parseLyrics("[00:03.5]<00:03.5>Hello <00:03.9>world\n[00:00.1]Intro\n[offset:200]")?.lines,
    ).toEqual([
      { time: 0, text: "Intro" },
      { time: 3.3, text: "Hello world" },
    ]);
    expect(parseLyrics("[00:01]Later\n[offset:-500]")?.lines[0].time).toBe(1.5);
  });
  it("finds active lines precisely on forward and backward seeks, including before the first cue", () => {
    const lines = parseLyrics("[00:01.10]One\n[00:01.50]Two\n[00:03]Three")!.lines;
    expect(
      [0, 1.09, 1.1, 1.49, 1.5, 50, 1.2, 0].map((time) => activeLyricIndex(lines, time)),
    ).toEqual([-1, -1, 0, 0, 1, 2, 0, -1]);
  });
});
