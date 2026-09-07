---
type: 'Concept'
title: 'OKF Specification'
description: 'Normative specification of the Open Knowledge Format for webmcp-sheets.'
tags: ['okf', 'spec', 'standards']
---

# Open Knowledge Format (OKF) Specification

The Open Knowledge Format (OKF) defines how architecture, data models, concepts, and contracts are documented in markdown files with standard YAML frontmatter.

## Frontmatter Standard
Every node must declare:
- `type`: 'Task Contract' | 'Data Model' | 'Architecture' | 'Concept'
- `title`: Short human-readable title
- `description`: Summary of the node
- `tags`: List of lowercase tags

See the root index at [index.md](index.md).
