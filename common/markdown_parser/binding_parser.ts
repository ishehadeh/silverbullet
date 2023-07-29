import {
  BlockContext,
  InlineContext,
  Language,
  LeafBlock,
  LeafBlockParser,
  Line,
  markdown,
  MarkdownConfig,
  StreamLanguage,
  Strikethrough,
  styleTags,
  tags as t,
  TaskList,
  yamlLanguage,
} from "../deps.ts";
import {
  BindingExpressionTag,
  BindingTag,
  BindingValueTag,
} from "./customtags.ts";
import {
  MDExt,
  mdExtensionStyleTags,
  mdExtensionSyntaxConfig,
} from "./markdown_ext.ts";

import { parser as expressionParser } from "./parse-expression.js";

const EXPRESSION_PARSER = expressionParser.configure({
  props: [
    styleTags({
      "Name": t.variableName,
      "String": t.string,
      "Number": t.number,
      "Null": t.null,
      "Where Limit Select Render Order OrderDirection And": t.keyword,
    }),
  ],
});

const START_CHAR = "$".charCodeAt(0);
const VALUE_START_CHAR = "(".charCodeAt(0);
const EXPR_END_CHAR = "]".charCodeAt(0);

function findExprEnd(cx: InlineContext, start: number): number | null {
  let inStr = false;
  let esc = false;
  const escChar = "\\".charCodeAt(0);
  const strStart = ['"'.charCodeAt(0), "“".charCodeAt(0), "”".charCodeAt(0)];
  const strEnd = ['"'.charCodeAt(0), "“".charCodeAt(0), "”".charCodeAt(0)];
  for (let i = start; i < cx.end; ++i) {
    if (esc) {
      // skip escape chars
      esc = false;
      continue;
    }

    const c = cx.char(i);

    if (c == escChar) {
      esc = true;
    } else if (inStr) {
      if (strEnd.includes(c)) {
        inStr = false;
      }
    } else {
      if (strStart.includes(c)) {
        inStr = true;
      }

      if (c == EXPR_END_CHAR) return i;
    }
  }

  return null;
}

function parse(cx: InlineContext, next: number, pos: number): number {
  // syntax elements, added at the end of the function
  const elts = [];

  if (next != START_CHAR || cx.slice(pos, pos + 2) != "$[") {
    return -1;
  }
  const exprStartPos = pos + 1;
  elts.push(cx.elt("BindingMark", pos, exprStartPos + 1));

  // first find the "]"
  const exprValueSplitToken = findExprEnd(cx, exprStartPos + 1);
  if (!exprValueSplitToken) {
    return -1;
  }
  const exprEndPos = pos + exprValueSplitToken;
  let endPos = exprEndPos;

  const exprParseTree = EXPRESSION_PARSER.parse(
    cx.slice(exprStartPos + 1, exprEndPos),
  );
  elts.push(
    cx.elt("BindingExpression", exprStartPos + 1, exprEndPos, [
      cx.elt(exprParseTree, exprStartPos + 1),
    ]),
  );
  elts.push(cx.elt("BindingMark", exprEndPos, exprEndPos + 1));

  // parse the value if available
  if (cx.char(exprEndPos + 1) == VALUE_START_CHAR) {
    const valueStartPos = exprEndPos + 1;
    elts.push(cx.elt("BindingMark", valueStartPos, valueStartPos + 1));

    // find the ending ")"
    // TODO: better way to do this
    const endTokenOffset = cx.slice(valueStartPos, cx.end).lastIndexOf(")");

    //  keep parsing the expression even without ")" to get syntax highlighting ASAP
    if (endTokenOffset !== -1) {
      const valueEndPos = valueStartPos + endTokenOffset;
      elts.push(cx.elt("BindingValue", valueStartPos + 1, valueEndPos));
      elts.push(cx.elt("BindingMark", valueEndPos, valueEndPos + 1));
      endPos = valueEndPos + 1;
    }
  }

  const elt = cx.elt("Binding", pos, endPos + 1, elts);
  return cx.addElement(elt);
}

export const Binding: MarkdownConfig = {
  defineNodes: [
    { name: "Binding", style: BindingTag },
    { name: "BindingMark", style: t.processingInstruction },
    { name: "BindingExpression", style: BindingExpressionTag },
    { name: "BindingValue", style: BindingValueTag },
  ],
  parseInline: [
    {
      name: "Binding",
      parse,
      after: "Emphasis",
    },
  ],
};
