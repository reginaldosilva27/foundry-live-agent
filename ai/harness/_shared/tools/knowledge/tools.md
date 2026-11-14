# Tools

The agent has four tools, owned by two different runtimes.

## Microsoft Learn MCP

A remote MCP server at https://learn.microsoft.com/api/mcp, with no authentication. Foundry calls
it directly; our application only observes the call. It answers questions about Azure and Foundry
documentation.

## Function tools

get_current_datetime, lookup_knowledge and search_web are function tools, which means Foundry emits
the call and then stops. Our backend must execute the function and return its output. If it does
not, the run hangs until it expires after ten minutes.

Function calling is client-side execution by definition, which is why it cannot be placed inside a
Foundry Toolbox.

## Web search

search_web queries the live internet through Tavily and returns ranked results with their URLs. It
is the only tool here that depends on a third-party service, and therefore the only one that needs
an API key: TAVILY_API_KEY. Every Azure service in this project authenticates with Microsoft Entra
ID instead, so that key is the single exception and is documented as one.

The agent chooses two things on every call: topic (general, or news for events the press reports)
and time_range (any, day, week, month or year). Each result carries a published_date, Tavily's
estimate of when the page was published, which can be empty. A search for something that just
happened needs the date in the query, news and a narrow window: Tavily's default search ranks
cached pages by relevance and has no idea what today is.

When the key is absent the tool answers search_unavailable rather than raising. A tool that raised
would leave a function call unanswered, which is the failure this repository most wants to avoid.
