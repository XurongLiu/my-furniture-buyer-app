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
    const err = new Error(`Azure OpenAI request failed (${res.status}): ${text.slice(0, 300)}`);
    // Azure's own safety filter (e.g. a detected jailbreak attempt) reports
    // this distinct error code — worth telling apart from a transient
    // network/outage failure, since "please try again" is misleading when
    // the same request will always be blocked.
    try {
      err.code = JSON.parse(text)?.error?.code;
    } catch {
      // leave err.code unset — text wasn't JSON
    }
    throw err;
  }

  const data = await res.json();
  return data.choices[0].message;
}
