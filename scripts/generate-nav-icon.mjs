/**
 * scripts/generate-nav-icon.mjs — 从设置包的 outline.svg 生成 settings.section.icon 组件。
 *
 * 唯一真源：packages/dsh-webui-transition-settings/assets/icons/outline.svg。
 * 生成物：packages/dsh-webui-transition-settings/src/nav-icon.js（提交，CI 校验一致）。
 *
 * 只支持白名单元素/属性：图标结构超出白名单时直接抛错，避免静默生成错误图形。
 * 颜色不在这里改写——SVG 里写 `currentColor`，外壳的 `.navCell` 负责着色。
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const settingsPackage = path.join(root, "packages", "dsh-webui-transition-settings");

export const NAV_ICON_SVG = path.join(settingsPackage, "assets", "icons", "outline.svg");
export const NAV_ICON_SOURCE = path.join(settingsPackage, "src", "nav-icon.js");

const ALLOWED_ELEMENTS = new Set(["path", "circle", "rect", "line", "polyline", "polygon", "g"]);
// 外壳负责尺寸与无障碍属性，SVG 根节点上的这些属性不参与生成。
const ROOT_DROP = new Set(["xmlns", "xmlns:xlink", "width", "height", "aria-hidden", "focusable"]);

function toPropName(name) {
  if (name === "class") return "className";
  return name.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}

function toLiteral(value, attribute) {
  if (value.includes("url(")) {
    throw new Error(`暂不支持引用型属性值（${attribute}）：${value}`);
  }
  return /^-?\d+(?:\.\d+)?$/.test(value) ? value : JSON.stringify(value);
}

function renderAttributes(element, dropRootAttributes = false) {
  const rendered = [];
  for (const { name, value } of element.attributes) {
    if (dropRootAttributes && ROOT_DROP.has(name)) continue;
    if (name === "style") throw new Error("暂不支持 style 属性，请改用 SVG 表现属性");
    rendered.push(`${toPropName(name)}: ${toLiteral(value, name)}`);
  }
  return rendered;
}

function renderChildren(element, depth) {
  const lines = [];
  for (const node of element.childNodes) {
    if (node.nodeType === node.ELEMENT_NODE) {
      lines.push(renderElement(node, depth));
    } else if (node.nodeType === node.TEXT_NODE) {
      if (node.textContent.trim() !== "") throw new Error("暂不支持 SVG 文本内容");
    } else if (node.nodeType !== node.COMMENT_NODE) {
      throw new Error(`不支持的 SVG 节点类型：${node.nodeType}`);
    }
  }
  return lines;
}

function renderElement(element, depth) {
  const tag = element.localName;
  if (!ALLOWED_ELEMENTS.has(tag)) {
    throw new Error(`不支持的 SVG 元素：<${tag}>（白名单：${[...ALLOWED_ELEMENTS].join(", ")}）`);
  }
  const indent = "  ".repeat(depth);
  const attributes = renderAttributes(element);
  const children = renderChildren(element, depth + 1);
  if (children.length === 0) {
    return `${indent}React.createElement(${JSON.stringify(tag)}, { ${attributes.join(", ")} }),`;
  }
  return [
    `${indent}React.createElement(`,
    `${indent}  ${JSON.stringify(tag)},`,
    `${indent}  { ${attributes.join(", ")} },`,
    ...children,
    `${indent}),`,
  ].join("\n");
}

function parseSvg(source) {
  const { window } = new JSDOM("");
  const document = new window.DOMParser().parseFromString(source, "image/svg+xml");
  const failure = document.querySelector("parsererror");
  if (failure) throw new Error(`outline.svg 解析失败：${failure.textContent ?? "未知错误"}`);
  const svg = document.documentElement;
  if (svg.localName !== "svg") throw new Error("outline.svg 根节点必须是 <svg>");
  if (!svg.getAttribute("viewBox")) throw new Error("outline.svg 缺少 viewBox");
  return svg;
}

function renderModule(svg) {
  const rootAttributes = renderAttributes(svg, true);
  const children = renderChildren(svg, 2);
  if (children.length === 0) throw new Error("outline.svg 不含任何图形元素");
  const lines = [
    "/**",
    " * packages/dsh-webui-transition-settings/src/nav-icon.js — 设置导航图标（生成文件，勿手改）。",
    " *",
    " * 由 scripts/generate-nav-icon.mjs 从",
    " * packages/dsh-webui-transition-settings/assets/icons/outline.svg 生成；",
    " * pnpm build 会重写本文件，CI 校验它与 SVG 一致。",
    " *",
    " * settings.section.icon 贡献：外壳在设置弹窗侧栏以 16px、aria-hidden 的装饰容器渲染它，",
    " * 颜色继承 .navCell 的 currentColor，文字与无障碍名来自 settings.section 的 label。",
    " * 用 React.createElement 而非 JSX，使本文件可被 Node 直接 import 做渲染测试。",
    " */",
    "",
    'import React from "react";',
    "",
    "/**",
    " * @param {{ size?: number }} props - 外壳传入的方形边长（px），默认 16。",
    " */",
    "export function NavIcon({ size = 16 }) {",
    "  return React.createElement(",
    '    "svg",',
    "    {",
    "      width: size,",
    "      height: size,",
    ...rootAttributes.map((attribute) => `      ${attribute},`),
    '      "aria-hidden": "true",',
    "    },",
    ...children,
    "  );",
    "}",
    "",
  ];
  return lines.join("\n");
}

/** 读 outline.svg，重写 src/nav-icon.js；由 scripts/build.mjs 在打包前调用。 */
export async function generateNavIcon() {
  const source = await readFile(NAV_ICON_SVG, "utf8");
  await writeFile(NAV_ICON_SOURCE, renderModule(parseSvg(source)), "utf8");
}
