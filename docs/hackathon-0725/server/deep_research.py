#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
deep_research.py —— 调用 Gemini Deep Research（Interactions API）跑深度调研

用法：
    GEMINI_API_KEY=xxx python3 server/deep_research.py \
        --prompt-file 调研/04-报告构建文件/dr_prompt_个人画像.md \
        --out 调研/GeminiDeepResearch_个人画像构建.md

    # 断线后续跑（不新建任务）：
    python3 server/deep_research.py --resume <interaction_id> --out xxx.md
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

import httpx

API_BASE = "https://generativelanguage.googleapis.com/v1beta"
AGENT = "deep-research-pro-preview-12-2025"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-file", help="调研 prompt 的 markdown 文件")
    parser.add_argument("--out", required=True, help="报告输出路径")
    parser.add_argument("--resume", help="已有 interaction id，断线恢复轮询")
    args = parser.parse_args()

    api_key = os.environ["GEMINI_API_KEY"]
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}

    with httpx.Client(timeout=120.0) as client:
        if args.resume:
            iid = args.resume
            print(f"[deep-research] resuming: {iid}", flush=True)
        else:
            prompt = open(args.prompt_file, encoding="utf-8").read()
            resp = client.post(
                f"{API_BASE}/interactions",
                headers=headers,
                json={"input": prompt, "agent": AGENT, "background": True},
            )
            resp.raise_for_status()
            iid = resp.json()["id"]
            print(f"[deep-research] started: {iid}", flush=True)

        deadline = time.time() + 40 * 60
        data: dict = {}
        while time.time() < deadline:
            time.sleep(30)
            for attempt in range(5):  # 代理偶发断连，轮询加重试
                try:
                    poll = client.get(f"{API_BASE}/interactions/{iid}", headers=headers)
                    poll.raise_for_status()
                    data = poll.json()
                    break
                except httpx.HTTPError as e:
                    print(f"[deep-research] poll error ({e}), retry {attempt + 1}/5", flush=True)
                    time.sleep(10)
            else:
                continue
            status = data.get("status")
            print(f"[deep-research] status={status}", flush=True)
            if status == "completed":
                break
            if status in ("failed", "cancelled"):
                print(json.dumps(data, ensure_ascii=False, indent=2))
                return 1
        else:
            print("[deep-research] timeout after 40min")
            return 1

    # 报告正文在 steps 里，取最长的 text 段（user_input 之外的那条）
    candidates = [
        c.get("text", "")
        for step in data.get("steps", [])
        for c in step.get("content", [])
        if c.get("text")
    ]
    text = max(candidates, key=len) if candidates else ""
    if not text:
        text = json.dumps(data, ensure_ascii=False, indent=2)

    with open(args.out, "w", encoding="utf-8") as f:
        f.write(f"> agent: {AGENT} · interaction: {iid}\n\n")
        f.write(text)
    print(f"[deep-research] saved -> {args.out} ({len(text)} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
