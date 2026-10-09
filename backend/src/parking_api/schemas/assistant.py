from pydantic import BaseModel, Field, model_validator


class AvailabilityQuestion(BaseModel):
    available_spots: int = Field(ge=0)
    taken_spots: int = Field(ge=0)
    question: str = Field(default="How many parking spots are available?", max_length=240)

    @model_validator(mode="after")
    def question_is_not_empty(self):
        if not self.question.strip():
            raise ValueError("Question cannot be empty")
        return self


class AvailabilityAnswer(BaseModel):
    answer: str
    available_spots: int
    taken_spots: int
    model: str
