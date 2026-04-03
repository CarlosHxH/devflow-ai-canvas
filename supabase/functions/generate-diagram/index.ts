import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a Mermaid.js diagram expert. Given a user description, generate ONLY valid Mermaid.js code. 
Rules:
- Output ONLY the Mermaid code, no markdown fences, no explanations
- Use Portuguese for labels when the user writes in Portuguese
- Support: graph/flowchart, sequence, class, state, ER, gantt, pie, mindmap
- Keep diagrams clean and readable
- Use proper Mermaid syntax`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, gemini_api_key } = await req.json();
    if (!prompt) throw new Error("Prompt é obrigatório");

    let url: string;
    let headers: Record<string, string>;
    let body: any;

    if (gemini_api_key) {
      // User's own Gemini API key → call Google directly
      url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${gemini_api_key}`;
      headers = { "Content-Type": "application/json" };
      body = {
        contents: [
          { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nUser request: ${prompt}` }] },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      };
    } else {
      // Fallback to Lovable AI gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("Nenhuma API key configurada. Adicione sua chave Gemini nas Configurações > API Keys.");

      url = "https://ai.gateway.lovable.dev/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      };
      body = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
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
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
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
      console.error("AI error:", response.status, text);
      throw new Error(gemini_api_key ? "Erro na API Gemini. Verifique sua chave." : "Erro no gateway de IA");
    }

    const data = await response.json();
    let mermaidCode: string;

    if (gemini_api_key) {
      // Parse Gemini direct response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // Strip markdown fences if present
      mermaidCode = text.replace(/^```(?:mermaid)?\n?/i, "").replace(/\n?```$/i, "").trim();
    } else {
      // Parse Lovable AI gateway response (OpenAI format)
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const args = JSON.parse(toolCall.function.arguments);
        mermaidCode = args.mermaid_code;
      } else {
        mermaidCode = data.choices?.[0]?.message?.content || "";
      }
    }

    return new Response(JSON.stringify({ mermaid_code: mermaidCode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-diagram error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
