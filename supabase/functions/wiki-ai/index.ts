import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, type } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error("messages é obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    let systemPrompt = "";
    if (type === "generate_doc") {
      systemPrompt = `You are a technical documentation expert. Generate well-structured Markdown documentation based on the user's request.
Rules:
- Use proper Markdown syntax with headers, lists, code blocks, tables as needed
- Write in the same language as the user's message
- Be thorough but concise
- Include code examples when relevant
- Use ## for main sections, ### for subsections`;
    } else if (type === "generate_mermaid") {
      systemPrompt = `You are a Mermaid.js diagram expert. Given a documentation context or user description, generate ONLY valid Mermaid.js code.
Rules:
- Output ONLY the Mermaid code, no markdown fences, no explanations
- Use the same language as the user for labels
- Support: flowchart, sequence, class, state, ER, gantt, pie, mindmap
- Keep diagrams clean and readable`;
    } else {
      systemPrompt = `You are a helpful AI assistant for a software engineering documentation wiki. 
You help users with:
- Answering technical questions based on their project documentation context
- Suggesting improvements to documentation
- Explaining code concepts
- Generating documentation sections

Rules:
- Be concise and technical
- Format responses in Markdown
- Write in the same language as the user's message
- Reference the documentation context when provided`;
    }

    const body: Record<string, unknown> = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    };

    if (type === "generate_mermaid") {
      body.stream = false;
      body.tools = [
        {
          type: "function",
          function: {
            name: "return_mermaid",
            description: "Return the generated Mermaid.js diagram code",
            parameters: {
              type: "object",
              properties: {
                mermaid_code: { type: "string", description: "The Mermaid.js diagram code" },
              },
              required: ["mermaid_code"],
              additionalProperties: false,
            },
          },
        },
      ];
      body.tool_choice = { type: "function", function: { name: "return_mermaid" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro no gateway de IA");
    }

    if (type === "generate_mermaid") {
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      let mermaidCode = "";
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        mermaidCode = args.mermaid_code;
      } else {
        mermaidCode = data.choices?.[0]?.message?.content || "";
      }
      return new Response(JSON.stringify({ mermaid_code: mermaidCode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream response
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("wiki-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
