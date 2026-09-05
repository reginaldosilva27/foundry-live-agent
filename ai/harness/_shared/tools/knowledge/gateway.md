# Gateway and tracing

## Two things called AI Gateway

The project-level AI Gateway governs direct model calls. Foundry Agent Service does not route its
internal inference through it. To route the agent's inference through your own Azure API Management
instance you use bring your own model, which is a separate Admin-connected model connection. With
that connection the agent's model is named connection-name/model-name.

## What the gateway does not tell you

The gateway does not log tool traces. Tool-level detail comes only from Foundry tracing, which lands
in Application Insights. Voice Live traffic never passes through any gateway.
