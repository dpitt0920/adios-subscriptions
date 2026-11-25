// A small Markdown renderer for Claude's work output. Supports headings,
// paragraphs, bullet and numbered lists, block quotes, code blocks, rules,
// **bold**, *italic*, `code`, [links](url) and bare URLs. Not a full parser:
// it only needs to make agent output readable.

import { Linking, Platform, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { AppText } from "@/components/AppText";
import { colors } from "@/lib/constants";

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: { text: string; marker: string; indent: number }[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string }
  | { type: "rule" };

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });
const CODE_BG = "#F1F1F4";

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i++]);
      i++; // closing fence
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].replace(/#+$/, "").trim() });
      i++;
      continue;
    }

    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: quote.join(" ") });
      continue;
    }

    if (LIST_ITEM.test(line)) {
      const ordered = /^\d/.test(trimmed);
      const items: { text: string; marker: string; indent: number }[] = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (m) {
          const indent = Math.min(Math.floor(m[1].replace(/\t/g, "  ").length / 2), 3);
          const isNumber = /^\d/.test(m[2]);
          items.push({ text: m[3], marker: isNumber ? m[2].replace(")", ".") : "•", indent });
          i++;
        } else if (lines[i].trim() && /^\s+/.test(lines[i]) && items.length) {
          // Continuation line of the previous item.
          items[items.length - 1].text += " " + lines[i].trim();
          i++;
        } else break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (!t || t.startsWith("```") || t.startsWith(">") || /^#{1,6}\s/.test(t) || LIST_ITEM.test(l)) break;
      para.push(t);
      i++;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

function openLink(url: string) {
  if (/^https?:\/\//i.test(url)) {
    WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

// Inline tokens: links, bare URLs, bold, italic, inline code.
const INLINE =
  /(\[([^\]]+)\]\(([^)\s]+)\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|(\*\*([^*]+)\*\*|__([^_]+)__)|(`([^`]+)`)|(\*([^*\s][^*]*)\*|\b_([^_\s][^_]*)_\b)/g;

function renderInline(text: string, keyPrefix = "i"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let n = 0;
  const matches = [...text.matchAll(INLINE)];
  for (const m of matches) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}-${n++}`;
    if (m[1]) {
      const url = m[3];
      out.push(
        <Text
          key={key}
          onPress={() => openLink(url)}
          style={{ color: colors.primary, textDecorationLine: "underline" }}
        >
          {renderInline(m[2], key)}
        </Text>
      );
    } else if (m[4]) {
      const url = m[4];
      out.push(
        <Text
          key={key}
          onPress={() => openLink(url)}
          style={{ color: colors.primary, textDecorationLine: "underline" }}
        >
          {url}
        </Text>
      );
    } else if (m[5]) {
      out.push(
        <Text key={key} className="font-din-rounded-bold">
          {renderInline(m[6] ?? m[7] ?? "", key)}
        </Text>
      );
    } else if (m[8]) {
      out.push(
        <Text key={key} style={{ fontFamily: MONO, backgroundColor: CODE_BG }}>
          {m[9]}
        </Text>
      );
    } else if (m[10]) {
      out.push(
        <Text key={key} style={{ fontStyle: "italic" }}>
          {renderInline(m[11] ?? m[12] ?? "", key)}
        </Text>
      );
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING_SIZES = ["text-xl", "text-lg", "text-base", "text-base", "text-sm", "text-sm"];

export function Markdown({ children }: { children: string }) {
  const blocks = parseBlocks(children);

  return (
    <View style={{ gap: 10 }}>
      {blocks.map((block, bi) => {
        const key = `b${bi}`;
        switch (block.type) {
          case "heading":
            return (
              <AppText
                key={key}
                fontWeight="bold"
                className={`${HEADING_SIZES[block.level - 1]} text-gray-900`}
                style={{ marginTop: bi === 0 ? 0 : 4 }}
              >
                {renderInline(block.text, key)}
              </AppText>
            );
          case "paragraph":
            return (
              <AppText key={key} selectable className="text-base text-gray-800 leading-6">
                {renderInline(block.text, key)}
              </AppText>
            );
          case "list":
            return (
              <View key={key} style={{ gap: 6 }}>
                {block.items.map((item, ii) => (
                  <View
                    key={`${key}-${ii}`}
                    className="flex-row"
                    style={{ gap: 8, paddingLeft: item.indent * 16 }}
                  >
                    <AppText
                      className="text-base text-muted-foreground leading-6"
                      style={{ minWidth: block.ordered ? 18 : 10 }}
                    >
                      {item.marker}
                    </AppText>
                    <AppText selectable className="flex-1 text-base text-gray-800 leading-6">
                      {renderInline(item.text, `${key}-${ii}`)}
                    </AppText>
                  </View>
                ))}
              </View>
            );
          case "quote":
            return (
              <View key={key} className="border-l-2 border-gray-300 pl-3">
                <AppText selectable className="text-base text-gray-600 leading-6">
                  {renderInline(block.text, key)}
                </AppText>
              </View>
            );
          case "code":
            return (
              <View key={key} className="rounded-xl px-3 py-2" style={{ backgroundColor: CODE_BG }}>
                <Text selectable style={{ fontFamily: MONO, fontSize: 13, color: "#1F2937" }}>
                  {block.text}
                </Text>
              </View>
            );
          case "rule":
            return <View key={key} className="h-px bg-gray-200 my-1" />;
          default:
            return null;
        }
      })}
    </View>
  );
}
