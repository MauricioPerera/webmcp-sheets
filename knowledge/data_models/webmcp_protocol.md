---
type: 'Data Model'
title: 'WebMCP Protocol Model'
description: 'Data model describing WebMCP tools, parameter schemas and invocation logs.'
tags: ['webmcp', 'fastwebmcp', 'protocol', 'data-model']
---

# WebMCP Protocol Model

Defines the structure of WebMCP tools exposed according to the W3C Web Machine Learning WebMCP draft and FastWebMCP.

## Structure
- `name`: tool identifier (e.g. `sheets_get_cell`)
- `description`: LLM-directed guidance of tool behavior
- `inputSchema`: Zod schema converted to standard JSON Schema
- `execute`: asynchronous callback receiving validated arguments

See [webmcp_bridge_arch.md](../architecture/webmcp_bridge_arch.md).
