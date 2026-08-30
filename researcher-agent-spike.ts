// Spike: Parallel Search as a Gemini function-calling tool (the Researcher agent shape)
import Parallel from 'parallel-web';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';

const parallel = new Parallel({ apiKey: 'test' });
const ai = new GoogleGenAI({ apiKey: 'test' });

const searchTool: FunctionDeclaration = {
  name: 'parallel_search',
  description: 'Search the web for factual verification with citations',
  parameters: {
    type: Type.OBJECT,
    properties: {
      objective: { type: Type.STRING },
      queries: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['objective'],
  },
};

async function researcherAgent(claim: string) {
  // 1. Gemini decides what to search
  const plan = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `Fact-check this script claim: ${claim}`,
    config: { tools: [{ functionDeclarations: [searchTool] }] },
  });

  const call = plan.functionCalls?.[0];
  if (!call) return null;

  // 2. Parallel executes: search, then extract full content from top source
  const search = await parallel.search({
    objective: String(call.args?.objective),
    search_queries: (call.args?.queries as string[]) ?? ['fact check'],
    mode: 'basic', // low latency; 'advanced' for deep passes
    advanced_settings: { max_results: 5 },
    client_model: 'gemini-flash-latest',
  });
  const top = search.results[0];
  const extract = top
    ? await parallel.extract({ urls: [top.url], session_id: search.session_id })
    : null;

  // 3. Gemini synthesizes the cited verdict
  return ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: JSON.stringify({ claim, search: search.results, extract: extract?.results }),
  });
}
researcherAgent('The 1969 moon landing was broadcast live on CBS');
