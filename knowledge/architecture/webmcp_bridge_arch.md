---
type: 'Architecture'
title: 'WebMCP Bridge Architecture'
description: 'Architecture of FastWebMCP and browser-native modelContext integration.'
tags: ['webmcp', 'fastwebmcp', 'agent', 'bridge', 'architecture']
---

# WebMCP Bridge Architecture

Exposes spreadsheet capabilities to autonomous AI agents through the Web Model Context Protocol.

## Dual Surfaces
1. **Imperative API**: Programmatic tool registration via `fastwebmcp` with Zod schema verification. Registers with `navigator.modelContext` where available, and provides fallback hooks.
2. **Declarative API**: Markup annotations using `toolname`, `tooldescription`, and `toolparamdescription` on `<form>` elements with `respondToAgentSubmit()`.

Refer to [webmcp_protocol.md](../data_models/webmcp_protocol.md).
