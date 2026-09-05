# Architecture

foundry-live-agent is a full-stack application built around an agent that runs inside Microsoft
Foundry. The frontend and backend contain no agent-loop logic.

## The BFF

The backend is a Backend For Frontend. Its whole job is identity, streaming, executing the function
tools Foundry asks for, trace lookup, and voice signalling. It never chooses which tool to call and
never re-prompts the model.

## Harnesses

A harness is a way of running the agent loop. The prompt-agent harness lets Foundry run the loop.
The langgraph harness would run the loop in our own container, hosted by Foundry. Both sit behind
one HarnessAdapter contract and emit the same AgentEvent stream, so the frontend, traces and voice
work with either.

## The AgentEvent contract

Nine event types: reasoning_summary, text_delta, tool_call, tool_result, mcp_call, usage, trace_ids,
error and done. Every harness emits only these; the BFF and frontend consume only these.
