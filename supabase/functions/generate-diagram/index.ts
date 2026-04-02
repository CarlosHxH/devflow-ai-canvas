import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // const URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key="+GOOGLE_API_KEY;

  try {
    const { prompt } = await req.json();
    if (!prompt) throw new Error("Prompt é obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GOOGLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a Mermaid.js diagram expert. Given a user description, generate ONLY valid Mermaid.js code. 
              Rules:
              - Output ONLY the Mermaid code, no markdown fences, no explanations
              - Use Portuguese for labels when the user writes in Portuguese
              - Support: graph/flowchart, sequence, class, state, ER, gantt, pie, mindmap
              - Keep diagrams clean and readable
              - Use proper Mermaid syntax`,
          },
          { role: "user", content: prompt },
        ],
        tools: [
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
        ],
        tool_choice: { type: "function", function: { name: "return_mermaid" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let mermaidCode: string;
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      mermaidCode = args.mermaid_code;
    } else {
      // Fallback to content
      mermaidCode = data.choices?.[0]?.message?.content || "";
    }

    return new Response(JSON.stringify({ mermaid_code: mermaidCode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-diagram error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
