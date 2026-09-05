# Tools

The agent has three tools, owned by two different runtimes.

## Microsoft Learn MCP

A remote MCP server at https://learn.microsoft.com/api/mcp, with no authentication. Foundry calls
it directly; our application only observes the call. It answers questions about Azure and Foundry
documentation.

## Function tools

get_current_datetime and lookup_knowledge are function tools, which means Foundry emits the call and
then stops. Our backend must execute the function and return its output. If it does not, the run
hangs until it expires after ten minutes.

Function calling is client-side execution by definition, which is why it cannot be placed inside a
Foundry Toolbox.
