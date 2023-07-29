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

import { parser as expressionParser } from "./parse-query.js";

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
const EXPR_VALUE_SPLIT_RE = /[^\\]\]\(?/g;
function parse(cx: InlineContext, next: number, pos: number): number {
  // syntax elements, added at the end of the function
  const elts = [];

  if (next != START_CHAR || cx.slice(pos, pos + 2) != "$[") {
    return -1;
  }
  const exprStartPos = pos + 1;
  elts.push(cx.elt("BindingStart", pos, pos + 1));
  elts.push(cx.elt("BindingExpressionStart", exprStartPos, exprStartPos + 1));

  // first find the "]("
  const exprValueSplitToken = EXPR_VALUE_SPLIT_RE.exec(cx.slice(pos, cx.end));
  if (!exprValueSplitToken) {
    return -1;
  }
  const exprEndPos = pos + exprValueSplitToken.index! + 1; // add 1 for [^\\]
  let endPos = exprEndPos;

  const expr = cx.slice(exprStartPos + 1, exprEndPos);
  const exprParseTree = EXPRESSION_PARSER.parse(expr);
  elts.push(
    cx.elt("BindingExpression", exprStartPos + 1, exprEndPos, [
      cx.elt(exprParseTree, exprStartPos + 1),
    ]),
  );
  elts.push(cx.elt("BindingExpressionEnd", exprEndPos, exprEndPos + 1));

  if (exprValueSplitToken[0].endsWith("(")) {
    const valueStartPos = exprEndPos + 1; // index of "(" char
    elts.push(cx.elt("BindingValueStart", valueStartPos, valueStartPos + 1));

    // find the ending )
    // TODO: better way to do this
    const endTokenOffset = cx.slice(valueStartPos, cx.end).lastIndexOf(")");

    //  keep parsing the expression even without ) to get syntax highlighting ASAP
    if (endTokenOffset !== -1) {
      const valueEndPos = valueStartPos + endTokenOffset;
      elts.push(cx.elt("BindingValue", valueStartPos + 1, valueEndPos));
      elts.push(cx.elt("BindingValueEnd", valueEndPos, valueEndPos + 1));
      endPos = valueEndPos;
    }
  }

  return cx.addElement(cx.elt("Binding", pos, endPos, elts));
}

export const Binding: MarkdownConfig = {
  defineNodes: [
    { name: "Binding", style: BindingTag },
    { name: "BindingStart" },
    { name: "BindingExpressionStart" },
    { name: "BindingExpression", style: BindingExpressionTag },
    { name: "BindingExpressionEnd" },
    { name: "BindingValueStart" },
    { name: "BindingValue", style: BindingValueTag },
    { name: "BindingValueEnd" },
  ],
  parseInline: [
    {
      name: "Binding",
      parse,
      before: "Link",
    },
  ],
};
