---
type: 'Architecture'
title: 'Hypermedia HTMX Architecture'
description: 'Client-side hypermedia architecture leveraging HTMX declarative workflows without a backend.'
tags: ['htmx', 'hypermedia', 'client-side', 'architecture']
---

# Hypermedia HTMX Architecture

Enables declarative hypermedia UI patterns across modal dialogues, toolbars, and contextual drawers.

## Mechanism
- Intercepts requests emitted by `hx-get`, `hx-post`, and `hx-put` using standard HTMX lifecycle events.
- Resolves endpoints to HTML template partials generated in-memory from client state.
- Injects HTML responses directly into target containers (`hx-target`) using DOM swap modes (`hx-swap`).

Refer to [webmcp_bridge_arch.md](webmcp_bridge_arch.md).
