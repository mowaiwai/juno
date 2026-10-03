"""驾驶舱问答 Schemas。"""

from pydantic import BaseModel, Field


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class AskOut(BaseModel):
    answer: str
    sources: list[str]
    model: str
