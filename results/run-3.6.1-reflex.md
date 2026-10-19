# GraphFlow 3.6.1 reflex-arc evaluation

Recorded 2026-10-19T00:56:21.022Z. Binary `@roarpeng/graphflow@3.6.1`. MCP server `graphflow 3.6.1` over stdio. Tools listed: gf_read, gf_edit, gf_exec, gf_macro.

Python shim: `PATH` prefixed with `/tmp/gf-bin` so `python` resolves to 3.12.3. Recorded steps call `python3` directly. Workspace for the run was a detached worktree `/tmp/gf-reflex-eval`, removed after the commands.

# GraphFlow eval score: pass
safety_gate: pass
passed 5  failed 0  skipped 0
mean_token_savings: 0.664
- reflex-learn-loop: pass
- reflex-mcp-invoke: pass
- reflex-near-threshold: pass
- reflex-arg-record: pass
- reflex-token-rounds: pass

## Token comparison

N=3 steady-state replays after the runner was already compiled.

- Baseline (instruction + both commands + full stdout/stderr) × 3: **750** tokens, 250 per round.
- Reflex (one `gf_macro` `task-run` tools/call + dehydrated text) × 3: **252** tokens (84, 84, 84).
- Savings: **0.664**.

## Jaccard probe

Threshold constant `0.86`. Library scores: near hit 0.875, dropped-token miss 0.8571428571428571, unrelated 0.
MCP near-hit score parsed from the tool text: 0.875.

## Gaps

- Auto-harvest still needs an external writer. This run called `graphflow task log` itself. GraphFlow 3.6.1 has no host hook or daemon that appends the instruction log.
- A MISS payload does not include the Jaccard score. The 0.857 figure is GraphFlow's exported jaccardSimilarity on the same strings. The HIT score is parsed from the MCP text `near match score=`.
- MCP task-run returns dehydrated text, not a JSON exitCode. Exit 0 is read from `PASS [exit=0`. CLI `reflect --json` is recorded beside it.
- {{argN}} is written by hand into the recorded step. The reflector does not infer parameters.
- Concurrent cross-process records (last writer wins) were not exercised.

## Per task

### reflex-learn-loop — pass

Commands:
- `graphflow task log "format lint and test billing package before release" --step "cd packages/billing-py && python3 -m compileall -q billing" --step "cd packages/billing-py && python3 -m unittest discover -s tests -v" --root /tmp/gf-reflex-eval` (exit 0)
- `graphflow task harvest --json --root /tmp/gf-reflex-eval` (exit 0)
- `graphflow task log "format lint and test billing package before release" --step "cd packages/billing-py && python3 -m compileall -q billing" --step "cd packages/billing-py && python3 -m unittest discover -s tests -v" --root /tmp/gf-reflex-eval` (exit 0)
- `graphflow task harvest --json --root /tmp/gf-reflex-eval` (exit 0)
- `graphflow task harvest --json --root /tmp/gf-reflex-eval` (exit 0)
- `graphflow task log "format lint and test billing package before release" --step "cd packages/billing-py && python3 -m compileall -q billing" --step "cd packages/billing-py && python3 -m unittest discover -s tests -v" --root /tmp/gf-reflex-eval` (exit 0)
- `MCP tools/call gf_macro {"action":"task-harvest"}` (exit 0)
Rubric: all checks passed.

```
$ graphflow task log "format lint and test billing package before release" --step "cd packages/billing-py && python3 -m compileall -q billing" --step "cd packages/billing-py && python3 -m unittest discover -s tests -v" --root /tmp/gf-reflex-eval
exit 0
OK [instruction-logged] at=2026-10-19T00:56:19.014Z log=.graphflow/instruction-log.jsonl (run `graphflow task harvest` to promote repeated instructions)


$ graphflow task harvest --json --root /tmp/gf-reflex-eval
exit 0
{
  "logPath": ".graphflow/instruction-log.jsonl",
  "entriesRead": 1,
  "entriesInvalid": 0,
  "usesRecorded": 1,
  "tasksPromoted": []
}


$ graphflow task log "format lint and test billing package before release" --step "cd packages/billing-py && python3 -m compileall -q billing" --step "cd packages/billing-py && python3 -m unittest discover -s tests -v" --root /tmp/gf-reflex-eval
exit 0
OK [instruction-logged] at=2026-10-19T00:56:19.282Z log=.graphflow/instruction-log.jsonl (run `graphflow task harvest` to promote repeated instructions)


$ graphflow task harvest --json --root /tmp/gf-reflex-eval
exit 0
{
  "logPath": ".graphflow/instruction-log.jsonl",
  "entriesRead": 1,
  "entriesInvalid": 0,
  "usesRecorded": 1,
  "tasksPromoted": [
    "t_ec82285a44"
  ]
}


$ graphflow task harvest --json --root /tmp/gf-reflex-eval
exit 0
{
  "logPath": ".graphflow/instruction-log.jsonl",
  "entriesRead": 0,
  "entriesInvalid": 0,
  "usesRecorded": 0,
  "tasksPromoted": []
}


$ graphflow task log "format lint and test billing package before release" --step "cd packages/billing-py && python3 -m compileall -q billing" --step "cd packages/billing-py && python3 -m unittest discover -s tests -v" --root /tmp/gf-reflex-eval
exit 0
OK [instruction-logged] at=2026-10-19T00:56:19.685Z log=.graphflow/instruction-log.jsonl (run `graphflow task harvest` to promote repeated instructions)


$ MCP tools/call gf_macro {"action":"task-harvest"}
exit 0
PASS [task-harvest] log=.graphflow/instruction-log.jsonl entries=1 invalid=0 uses=1 promoted=t_ec82285a44
```

### reflex-mcp-invoke — pass

Commands:
- `MCP tools/call gf_macro {"action":"task-list"}` (exit 0)
- `MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}` (exit 0)
- `graphflow reflect "format lint and test billing package before release" --json --root /tmp/gf-reflex-eval` (exit 0)
Rubric: all checks passed.

```
$ MCP tools/call gf_macro {"action":"task-list"}
exit 0
# Reflected Tasks (1):
- t_ec82285a44 [uses=3, compiled]: format lint and test billing package before release

$ MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}
exit 0
# Reflected Task t_ec82285a44 [uses=4, local-runner] exact normalized match
Instruction: format lint and test billing package before release

PASS [exit=0, 105ms] PASS [local-task] 2 step(s) [raw 998B -> gfo:f5cbe115f441]

$ graphflow reflect "format lint and test billing package before release" --json --root /tmp/gf-reflex-eval
exit 0
{
  "hit": true,
  "text": "# Reflected Task t_ec82285a44 [uses=5, local-runner] exact normalized match\nInstruction: format lint and test billing package before release\n\nPASS [exit=0, 104ms] PASS [local-task] 2 step(s) [raw 998B -> gfo:f5cbe115f441]",
  "exitCode": 0,
  "durationMs": 104,
  "taskId": "t_ec82285a44",
  "matchedBy": "exact",
  "score": 1
}

```

### reflex-near-threshold — pass

Commands:
- `MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release quietly"}` (exit 0)
- `MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing before release"}` (exit 0)
- `MCP tools/call gf_macro {"action":"task-run","instruction":"ship the warehouse reservation hold"}` (exit 0)
- `graphflow reflect "format lint and test billing before release" --json --root /tmp/gf-reflex-eval` (exit 1)
- `graphflow reflect "ship the warehouse reservation hold" --json --root /tmp/gf-reflex-eval` (exit 1)
Rubric: all checks passed.

```
$ MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release quietly"}
exit 0
# Reflected Task t_ec82285a44 [uses=6, local-runner] near match score=0.875
Instruction: format lint and test billing package before release

PASS [exit=0, 98ms] PASS [local-task] 2 step(s) [raw 998B -> gfo:f5cbe115f441]

$ MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing before release"}
exit 0
MISS [no-reflected-task] No reflected task matched "format lint and test billing before release".
Record the same instruction 2x with its shell steps to compile a local runner, e.g.
  graphflow task record "<instruction>" --step "<cmd>"
or MCP gf_macro({ action: "task-record", instruction, steps: ["<cmd>"] }).

$ MCP tools/call gf_macro {"action":"task-run","instruction":"ship the warehouse reservation hold"}
exit 0
MISS [no-reflected-task] No reflected task matched "ship the warehouse reservation hold".
Record the same instruction 2x with its shell steps to compile a local runner, e.g.
  graphflow task record "<instruction>" --step "<cmd>"
or MCP gf_macro({ action: "task-record", instruction, steps: ["<cmd>"] }).

$ graphflow reflect "format lint and test billing before release" --json --root /tmp/gf-reflex-eval
exit 1
{
  "hit": false,
  "text": "MISS [no-reflected-task] No reflected task matched \"format lint and test billing before release\".\nRecord the same instruction 2x with its shell steps to compile a local runner, e.g.\n  graphflow task record \"<instruction>\" --step \"<cmd>\"\nor MCP gf_macro({ action: \"task-record\", instruction, steps: [\"<cmd>\"] }).",
  "exitCode": 1,
  "durationMs": 2
}


$ graphflow reflect "ship the warehouse reservation hold" --json --root /tmp/gf-reflex-eval
exit 1
{
  "hit": false,
  "text": "MISS [no-reflected-task] No reflected task matched \"ship the warehouse reservation hold\".\nRecord the same instruction 2x with its shell steps to compile a local runner, e.g.\n  graphflow task record \"<instruction>\" --step \"<cmd>\"\nor MCP gf_macro({ action: \"task-record\", instruction, steps: [\"<cmd>\"] }).",
  "exitCode": 1,
  "durationMs": 2
}

```

### reflex-arg-record — pass

Commands:
- `MCP tools/call gf_macro {"action":"task-record","instruction":"print the billing batch tag","steps":["echo PASS batch={{arg1}}"]}` (exit 0)
- `graphflow task record "print the billing batch tag" --step "echo PASS batch={{arg1}}" --json --root /tmp/gf-reflex-eval` (exit 0)
- `MCP tools/call gf_macro {"action":"task-run","instruction":"print the billing batch tag","args":["R3"]}` (exit 0)
Rubric: all checks passed.

```
$ MCP tools/call gf_macro {"action":"task-record","instruction":"print the billing batch tag","steps":["echo PASS batch={{arg1}}"]}
exit 0
OK [task-recorded] id=t_b6bdb462b3 uses=1/2 not-compiled-yet instruction="print the billing batch tag"

$ graphflow task record "print the billing batch tag" --step "echo PASS batch={{arg1}}" --json --root /tmp/gf-reflex-eval
exit 0
{
  "id": "t_b6bdb462b3",
  "instructionRaw": "print the billing batch tag",
  "instructionKey": "print bill batch tag",
  "count": 2,
  "steps": [
    "echo PASS batch={{arg1}}"
  ],
  "createdAt": "2026-10-19T00:56:20.543Z",
  "lastUsedAt": "2026-10-19T00:56:20.686Z",
  "scriptPath": ".graphflow/tasks/t_b6bdb462b3.mjs"
}


$ MCP tools/call gf_macro {"action":"task-run","instruction":"print the billing batch tag","args":["R3"]}
exit 0
# Reflected Task t_b6bdb462b3 [uses=3, local-runner] exact normalized match
Instruction: print the billing batch tag

PASS [exit=0, 30ms] PASS batch=R3 | PASS [local-task] 1 step(s)
```

### reflex-token-rounds — pass

Commands:
- `MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}` (exit 0)
- `MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}` (exit 0)
- `MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}` (exit 0)
Rubric: all checks passed.

```
$ MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}
exit 0
# Reflected Task t_ec82285a44 [uses=7, local-runner] exact normalized match
Instruction: format lint and test billing package before release

PASS [exit=0, 98ms] PASS [local-task] 2 step(s) [raw 998B -> gfo:f5cbe115f441]

$ MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}
exit 0
# Reflected Task t_ec82285a44 [uses=8, local-runner] exact normalized match
Instruction: format lint and test billing package before release

PASS [exit=0, 99ms] PASS [local-task] 2 step(s) [raw 998B -> gfo:f5cbe115f441]

$ MCP tools/call gf_macro {"action":"task-run","instruction":"format lint and test billing package before release"}
exit 0
# Reflected Task t_ec82285a44 [uses=9, local-runner] exact normalized match
Instruction: format lint and test billing package before release

PASS [exit=0, 94ms] PASS [local-task] 2 step(s) [raw 998B -> gfo:f5cbe115f441]
```

## Harvest state

Log lines: 3. Bytes: 726. Offset before the MCP harvest: 484. Offset after: 726.
First CLI harvest entries=1 promoted=[].
Second CLI harvest entries=1 promoted=["t_ec82285a44"].
Idle CLI harvest entries=0.
MCP harvest text: PASS [task-harvest] log=.graphflow/instruction-log.jsonl entries=1 invalid=0 uses=1 promoted=t_ec82285a44

