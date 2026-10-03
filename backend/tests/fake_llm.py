"""测试用假 LLM 客户端：不触网，返回结构化出题结果。

行为可通过 set_handler 临时定制（模拟失败/重试）。
"""
import json

from app.services.llm import LLMResult


def _default_handler(messages):
    content = json.dumps(
        {
            "questions": [
                "请描述一次你独立负责的复杂模块设计，你是如何权衡方案的？",
                "当项目关键路径出现延期风险时，你会如何协调资源并推进？",
                "请举一个你指导初级同事解决技术难题的例子，你的介入边界是什么？",
            ],
            "opinion": "自评与举证整体支撑达标，建议面试重点考察系统设计权衡与跨角色协调。",
        },
        ensure_ascii=False,
    )
    return content, 120, 80


class FakeLLMClient:
    # 类级 handler：所有实例共享，测试可临时替换
    handler = staticmethod(_default_handler)

    def chat(self, messages):
        content, prompt_tokens, completion_tokens = FakeLLMClient.handler(messages)
        return LLMResult(
            content=content,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )


def set_handler(handler):
    FakeLLMClient.handler = staticmethod(handler)


def reset_handler():
    FakeLLMClient.handler = staticmethod(_default_handler)
