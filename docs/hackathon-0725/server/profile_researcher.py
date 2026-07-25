#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
profile_researcher —— 「世界互访」画像调研服务组件

输入任意 URL（个人主页 / 博客 / GitHub / 微博 / 公众号文章 …）或本地文件
（PDF 简历 / 个人介绍文本），Agent 自动抓取内容并整理出一份结构化的「自我介绍」。

链路：URL/PDF → Jina Reader / PyMuPDF（内容转纯文本）→ GLM（提炼画像）→ 结构化 JSON

用法：
    export ZHIPU_API_KEY=...          # 已在环境中则无需重复设置
    python3 server/profile_researcher.py <url或本地文件路径>
    python3 server/profile_researcher.py <url> --raw      # 同时打印抓取的原文
    python3 server/profile_researcher.py <url> -o out.json

后续接入 FastAPI 时直接调用 research(url) 即可，无需改动本文件。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time

import httpx

JINA_READER_PREFIX = "https://r.jina.ai/"
# 免费无 key 档限流很狠（并发 3 路实测延迟从 ~10s 涨到 ~40s），
# 去 https://jina.ai/reader 申请免费 key 可显著提速；设置了环境变量就自动带上。
JINA_API_KEY = os.getenv("JINA_API_KEY")
ZHIPU_CHAT_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
DEFAULT_MODEL = os.getenv("PROFILE_LLM_MODEL", "glm-4-flash")
MAX_PAGE_CHARS = 12000  # 喂给 LLM 的正文上限，防止超长主页打爆上下文


# ---------------------------------------------------------------------------
# 1. 抓取：URL → Markdown
# ---------------------------------------------------------------------------

class FetchError(RuntimeError):
    pass


def extract_pdf_text(source) -> str:
    """从本地路径或 PDF 字节流提取全文。"""
    import fitz  # PyMuPDF，延迟导入，避免无 PDF 需求时强依赖

    doc = fitz.open(source) if isinstance(source, str) else fitz.open(stream=source, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc).strip()
    if len(text) < 50:
        raise FetchError("PDF 提取出的文本过少（可能是扫描件，需要 OCR，暂不支持）")
    return text


def _fetch_page_once(source: str, timeout: float = 40.0) -> str:
    """URL 走 Jina Reader 转 Markdown（失败直连抓取兜底）；本地 PDF/文本文件直接解析。"""
    if os.path.exists(source):  # 本地文件：PDF 用 PyMuPDF，其余按纯文本读
        if source.lower().endswith(".pdf"):
            return extract_pdf_text(source)
        with open(source, encoding="utf-8", errors="ignore") as f:
            return f.read()

    url = source
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    headers = {"Accept": "text/plain", "X-Return-Format": "markdown"}
    if JINA_API_KEY:
        headers["Authorization"] = f"Bearer {JINA_API_KEY}"
    try:
        resp = httpx.get(
            JINA_READER_PREFIX + url,
            headers=headers,
            timeout=timeout,
            follow_redirects=True,
        )
        if resp.status_code == 200 and len(resp.text.strip()) > 50:
            return resp.text
    except httpx.HTTPError:
        pass

    # 兜底：直接抓取；PDF 走 PyMuPDF，HTML 粗暴去标签（够用即可，正式版可换 readability）
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; WorldVisitBot/0.1)"},
            timeout=timeout,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise FetchError(f"抓取失败：{url}（{e}）") from e

    if "pdf" in resp.headers.get("content-type", "") or url.lower().endswith(".pdf"):
        return extract_pdf_text(resp.content)

    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", resp.text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 50:
        raise FetchError(f"页面内容为空或需要登录：{url}")
    return text


def fetch_page(url: str, timeout: float = 40.0, retries: int = 2) -> str:
    """带重试的抓取入口：实测现场级网络抖动（SSL EOF 等）会让两条抓取路径同时失败，
    整体重试一次即可大部分自愈。"""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            return _fetch_page_once(url, timeout=timeout)
        except FetchError as e:
            last_err = e
            if attempt + 1 < retries:
                time.sleep(3)
    raise last_err  # type: ignore[misc]


# ---------------------------------------------------------------------------
# 2. 提炼：Markdown → 结构化自我介绍
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """你是「世界互访」的画像调研员。给你一段从用户提供的 URL 或文件（简历 PDF 等）
中提取的内容，你要为主人整理一份第一人称的「自我介绍」，供后续生成ta的专属虚拟世界使用。

严格要求：
1. 只输出一个 JSON 对象，不要输出任何其他文字、不要用 markdown 代码块包裹。
2. 所有字段用简体中文；拿不准的字段留空字符串或空数组，禁止编造。
3. intro 中提到的每一个具体事实（作品、爱好、经历、数字）都必须能在网页原文中找到依据；
   原文没说的爱好、习惯一律不写。原文信息很少时，intro 就写得短而克制。
4. JSON 结构如下：
{
  "name": "主人公的名字/昵称（没有就给页面标题）",
  "title": "身份或职业，一句话",
  "one_liner": "一句话概括这个人是谁（≤30字，第三人称）",
  "intro": "第一人称自我介绍，口语化、有温度，80~150字",
  "tags": ["3~6个兴趣/领域标签"],
  "skills_or_works": ["技能或代表作，最多5条"],
  "personality": ["从行文风格推断的性格关键词，最多3个"],
  "facts": ["页面中明确提到、值得记住的事实，最多5条"],
  "source_guess": "这个来源是什么类型（如 GitHub主页/个人博客/作品集/简历PDF/公司简介）"
}"""


def _extract_json(text: str) -> dict:
    """从模型输出里稳健地抠出 JSON 对象。"""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.S)
    if match:
        return json.loads(match.group(0))
    raise ValueError("模型输出中找不到 JSON")


def summarize(page_text: str, url: str, model: str = DEFAULT_MODEL) -> dict:
    api_key = os.getenv("ZHIPU_API_KEY")
    if not api_key:
        raise RuntimeError("缺少环境变量 ZHIPU_API_KEY")

    user_prompt = f"来源：{url}\n\n提取内容：\n{page_text[:MAX_PAGE_CHARS]}"
    last_err: Exception | None = None
    for attempt in range(2):  # 失败重试 1 次（对齐架构文档的 LLM 调用策略）
        try:
            resp = httpx.post(
                ZHIPU_CHAT_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.1,
                },
                timeout=60.0,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return _extract_json(content)
        except Exception as e:  # noqa: BLE001 —— 重试后统一抛出
            last_err = e
    raise RuntimeError(f"LLM 提炼失败（重试1次后仍失败）：{last_err}")


# ---------------------------------------------------------------------------
# 3. 主流程
# ---------------------------------------------------------------------------

PROFILE_SCHEMA_KEYS = [
    "name", "title", "one_liner", "intro",
    "tags", "skills_or_works", "personality", "facts", "source_guess",
]


def research(url: str, model: str = DEFAULT_MODEL) -> dict:
    """输入 URL，返回结构化自我介绍。这是后续接 FastAPI 的唯一入口。"""
    page = fetch_page(url)
    profile = summarize(page, url, model=model)
    profile = {k: profile.get(k, [] if k in ("tags", "skills_or_works", "personality", "facts") else "")
               for k in PROFILE_SCHEMA_KEYS}
    profile["url"] = url
    # 质量门：正文太少（JS 渲染页/需登录页）时画像必然空泛——实测少数派主页
    # 只抓到少量文字，产出全是「正确的废话」。上层（H5）应据此提示换 URL 或手动补标签。
    profile["content_chars"] = len(page)
    profile["low_content"] = len(page) < 800
    return profile


def render_text(profile: dict) -> str:
    lines = [
        f"【{profile['name']}】{profile['title']}",
        f"一句话：{profile['one_liner']}",
        "",
        "自我介绍：",
        profile["intro"],
        "",
        "标签：" + "、".join(profile["tags"]),
        "技能/作品：" + "；".join(profile["skills_or_works"]),
        "性格关键词：" + "、".join(profile["personality"]),
        "值得记住的事实：",
    ]
    lines += [f"  - {f}" for f in profile["facts"]]
    lines.append(f"（页面类型：{profile['source_guess']}）")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="输入 URL 或本地文件（PDF/文本），输出主人的自我介绍")
    parser.add_argument("source", help="http(s) URL，或本地 PDF / 文本文件路径")
    parser.add_argument("--raw", action="store_true", help="同时打印抓取到的网页原文")
    parser.add_argument("-o", "--output", help="把 JSON 结果写入文件")
    args = parser.parse_args()

    if args.raw:
        print(fetch_page(args.source)[:MAX_PAGE_CHARS])
        print("\n" + "=" * 60 + "\n")

    profile = research(args.source)
    print(render_text(profile))
    print("\n--- JSON ---")
    print(json.dumps(profile, ensure_ascii=False, indent=2))

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(profile, f, ensure_ascii=False, indent=2)
        print(f"\n已写入 {args.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
