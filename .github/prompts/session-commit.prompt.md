---
name: Session Commit
description: "Review current git changes, identify which belong to this session, show the exact staging file list and full commit message in chat, then open a confirmation popup and commit after confirmation."
argument-hint: "Optionally describe what this session worked on to help filter changes"
---

Help me commit the changes from this session.

Context about this session (if any): {{input}}

## Execution Phases

This workflow has three strict phases. You must complete each phase fully before starting the next.

### Phase 1 — Gather changes

1. Run `git status` and `git diff --stat` to see all uncommitted changes.
2. If I provided session context above, use it to identify which files and hunks are likely from this session. If not, show me the full change list and ask me to confirm which changes to include.
3. For files that may contain mixed changes from multiple sessions, show the relevant `git diff <file>` and ask whether to stage the whole file or use `git add -p` to stage specific hunks.

### Phase 2 — Show proposal in chat (MANDATORY before any popup)

After agreeing on the change set, you MUST print the full proposal in chat using the exact template below. Do NOT skip or abbreviate any section. If a section has no items, print the header and write `- none`.

```
## Proposed Staging Files (Tracked)
- path/to/file1
- path/to/file2

## Proposed Staging Files (Untracked)
- path/to/new-file (brief description)

## Proposed Commit Message
<type>(<scope>): <subject>

- change 1
- change 2

## Partial Staging Plan
- whole file: path/to/file1, path/to/file2
- git add -p: path/to/file3 (reason for partial staging)
```

Generate the commit message using Conventional Commits format:
- Type: feat, fix, docs, refactor, test, chore, etc.
- Scope: the primary module or area affected
- Subject: concise imperative description
- Body: bullet list of key changes if there are multiple

**CRITICAL STOP**: After printing this template block, pause and verify that it is fully visible in chat. Only then proceed to Phase 3.

### Phase 3 — Popup confirmation and commit

PREREQUISITE CHECK: Phase 3 is BLOCKED until Phase 2 output is fully printed in chat. If you have not yet printed the proposal template above, go back and do Phase 2 now.

1. Open a popup interactive dialog (using the ask-questions tool) with exactly two fields:
   - `是否确认提交`：single-select options `Yes` / `No`
   - `修改要求`：freeform text input for optional feedback
2. If I choose `Yes`, run `git add` and `git commit`, then show `git log --oneline -1`.
3. If I choose `No` with feedback, update the change set and/or commit message, print the full updated proposal template in chat again (repeat Phase 2), then open the popup again.
4. If I choose `No` without feedback, ask in the popup what should be changed. Keep the workflow active until I confirm or explicitly cancel.

## Rules

- Never force-push or amend without explicit permission.
- Never stage files I haven't confirmed.
- If `git status` shows untracked files, list them separately and ask whether to include.
- If there are no uncommitted changes, say so and stop.
- The popup is ONLY for confirmation. The user must always see the full file list and commit message in chat BEFORE any popup appears. This is a hard sequencing requirement, not a suggestion.
- Every confirmation or re-confirmation round must use the popup dialog with the same two fields.
- If the proposal changes for any reason, the updated proposal must be printed in chat before the next popup.
