// Thin client for Azure OpenAI's chat completions endpoint (the standard
// OpenAI-compatible contract — confirmed directly against the deployment
// before writing this, including that its tool-calling response shape
// matches the usual {message: {tool_calls: [...]}} form).
export async function callAgentModel(messages, tools) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  const res = await fetch(
    `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
    {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Azure OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices[0].message;
}
