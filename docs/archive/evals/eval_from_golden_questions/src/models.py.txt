# -*- coding: utf-8 -*-
"""Data models for RAG evaluation system."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class GoldenQuestion(BaseModel):
    """Represents a golden question from the input JSONL."""

    id: str = Field(..., min_length=1)
    question: str = Field(..., min_length=1)
    original_question: str = Field(..., min_length=1)
    conversation_id: str = Field(..., min_length=1)
    context_messages: List[Dict[str, str]] = Field(default_factory=list)
    has_retrieval: bool = True
    subject_topics: Optional[List[str]] = None
    usage_mode: Optional[Dict[str, str]] = None
    metadata: Optional[Dict[str, Any]] = None
    question_changed: Optional[bool] = None
    filters: Optional[Dict[str, Any]] = None


class MetricResult(BaseModel):
    """Result for a single metric."""

    score: float | None = None
    success: bool = False
    error: Optional[str] = None
    reason: Optional[str] = None
    threshold: Optional[float] = None


class MetricScores(BaseModel):
    """Scores from DeepEval metrics with success/error status."""

    metrics: Dict[str, MetricResult] = Field(default_factory=dict)


class RAGEvaluation(BaseModel):
    """Complete evaluation result for one question."""

    question_id: str
    question: str
    answer: str
    chunks: List[Dict[str, str]]
    metrics: MetricScores
    metadata: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class AggregateStats(BaseModel):
    """Aggregate statistics across all evaluations."""

    mean: float
    std: float
    min: float
    max: float
    threshold: Optional[float] = None


class EvaluationResults(BaseModel):
    """Collection of all evaluation results."""

    evaluations: List[RAGEvaluation]
    aggregate: Dict[str, AggregateStats]
    total_count: int
    error_count: int
    success_count: int
