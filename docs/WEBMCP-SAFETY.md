# WebMCP safety model

All WebMCP registrations dispatch through `WebMcpService.executeTool`. The dispatcher validates Zod input, applies bounded resource limits, and records both success and failure in the execution log.

Destructive commands are previews. `sheets_clear_range`, `sheets_delete_sheet`, and `sheets_find_replace` produce a 60-second operation ID and no workbook change. An agent then calls `sheets_confirm_operation`; a visible browser dialog requires the user's direct approval before the change occurs.

Limits: a range has at most 10,000 cells, a matrix at most 100 rows by 100 columns, each text input 10,000 characters, and an exported payload 1 MB.
