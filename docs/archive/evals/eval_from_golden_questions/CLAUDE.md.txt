# Golden Questions Project

This project extracts high-quality evaluation questions from production conversation threads for RAG system evaluation.

## Spec-Driven Development (MANDATORY)

**CRITICAL**: For ALL new features, you MUST use the spec-tdd-developer agent.

### When to Use

```
User requests a feature → Launch spec-tdd-developer agent immediately
```

### How to Launch

```
Use Task tool with:
- subagent_type: "spec-tdd-developer"
- prompt: "Implement [feature name]"
```

### Rules

1. **No coding without the agent** - Launch spec-tdd-developer first
2. **Follow agent's workflow** - It enforces the 4-step process
3. **Do not skip agent verification** - Required before completion
4. **Spec location**: `specs/spec_name.md`

The spec-tdd-developer agent will:
- Analyze the specification
- Create task list with TodoWrite
- Guide implementation iteratively
- Enforce linting checks
- Verify spec is updated
- Validate against acceptance criteria

## Testing Conventions

- Framework: pytest
- Location: `tests/` directory mirroring `src/` structure
- Coverage target: >80%
- Design for testability: avoid side effects, use dependency injection

## Directory Structure

```
root/
├── CLAUDE.md                          # This file
├── specs/                             # Feature specifications
├── src/                               # Source code
├── tests/                             # Unit tests
├── output/                            # Generated output (gitignored)
```
