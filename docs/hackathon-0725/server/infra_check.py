#!/usr/bin/env python3
"""Day 0 基础设施冒烟测试：Redis + MQTT(EMQX 公共 broker)。

用法: server/.venv/bin/python server/infra_check.py
逐项检查，单项失败不中断后续测试，末尾打印汇总表。
"""

import subprocess
import sys
import time
import uuid

import redis
import paho.mqtt.client as mqtt


def check_redis(host="127.0.0.1", port=6379):
    """连接 Redis，SET/GET/DEL 一个键，测往返延迟。连接失败时尝试 brew 启动并重试一次。"""
    key = f"infra_check:{uuid.uuid4().hex[:8]}"
    value = f"smoke-{int(time.time() * 1000)}"

    def _roundtrip():
        client = redis.Redis(host=host, port=port, socket_timeout=3, socket_connect_timeout=3)
        t0 = time.perf_counter()
        client.ping()
        client.set(key, value)
        got = client.get(key)
        client.delete(key)
        latency_ms = (time.perf_counter() - t0) * 1000
        if got is None or got.decode() != value:
            raise RuntimeError(f"GET 回读不符: {got!r}")
        client.close()
        return latency_ms

    last_err = None
    for attempt in (1, 2):
        try:
            latency_ms = _roundtrip()
            return True, latency_ms, f"SET/GET/DEL 成功(第 {attempt} 次尝试)"
        except Exception as e:  # noqa: BLE001 - 冒烟测试要兜住所有错误
            last_err = e
            if attempt == 1:
                print(f"  [redis] 首次连接失败({e})，尝试 brew services start redis ...")
                try:
                    subprocess.run(
                        ["brew", "services", "start", "redis"],
                        capture_output=True, text=True, timeout=60,
                    )
                except Exception as brew_err:  # noqa: BLE001
                    print(f"  [redis] brew 启动失败: {brew_err}")
                time.sleep(2)
    return False, None, f"Redis 不可用: {last_err}"


def check_mqtt(broker="broker.emqx.io", port=1883, timeout=5.0):
    """用公共 broker 做 QoS1 pub/sub 回环，测端到端延迟。"""
    suffix = uuid.uuid4().hex[:8]
    topic = f"wvtest/{suffix}"
    payload = f"smoke-{int(time.time() * 1000)}-{suffix}"
    result = {"latency_ms": None, "error": None, "sent_at": None}

    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"wvtest-{suffix}",
        protocol=mqtt.MQTTv311,
    )

    def on_connect(c, userdata, flags, reason_code, properties):
        if reason_code.is_failure:
            result["error"] = f"连接被拒: {reason_code}"
            return
        c.subscribe(topic, qos=1)

    def on_subscribe(c, userdata, mid, reason_codes, properties):
        result["sent_at"] = time.perf_counter()
        c.publish(topic, payload, qos=1)

    def on_message(c, userdata, msg):
        if msg.payload.decode(errors="replace") == payload and result["latency_ms"] is None:
            result["latency_ms"] = (time.perf_counter() - result["sent_at"]) * 1000
            c.disconnect()

    client.on_connect = on_connect
    client.on_subscribe = on_subscribe
    client.on_message = on_message

    try:
        client.connect(broker, port, keepalive=int(timeout) + 2)
    except Exception as e:  # noqa: BLE001
        return False, None, f"无法连接 {broker}:{port}: {e}"

    client.loop_start()
    deadline = time.perf_counter() + timeout
    while result["latency_ms"] is None and result["error"] is None and time.perf_counter() < deadline:
        time.sleep(0.05)
    client.loop_stop()
    try:
        client.disconnect()
    except Exception:  # noqa: BLE001
        pass

    if result["latency_ms"] is not None:
        return True, result["latency_ms"], f"QoS1 回环成功，主题 {topic}"
    if result["error"]:
        return False, None, result["error"]
    return False, None, f"超时 {timeout:.0f}s 未收到自己发布的消息(主题 {topic})"


def main():
    print("=" * 60)
    print("Day 0 基础设施冒烟测试")
    print("=" * 60)

    results = []

    print("\n[1/2] Redis @ 127.0.0.1:6379 ...")
    ok, latency, note = check_redis()
    print(f"  -> {'PASS' if ok else 'FAIL'} | {note}")
    results.append(("Redis SET/GET/DEL", ok, latency, note))

    print("\n[2/2] MQTT @ broker.emqx.io:1883 ...")
    ok, latency, note = check_mqtt()
    print(f"  -> {'PASS' if ok else 'FAIL'} | {note}")
    results.append(("MQTT pub/sub 回环", ok, latency, note))

    print("\n" + "=" * 60)
    print("汇总")
    print("=" * 60)
    print(f"{'测试项':<22}{'结果':<8}{'延迟':>12}")
    print("-" * 44)
    for name, ok, latency, _ in results:
        lat = f"{latency:.1f} ms" if latency is not None else "-"
        print(f"{name:<22}{'PASS' if ok else 'FAIL':<8}{lat:>12}")

    all_ok = all(r[1] for r in results)
    print(f"\n总体: {'全部通过' if all_ok else '存在失败项(见上)'}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
