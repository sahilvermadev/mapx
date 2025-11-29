/**
 * Search Orchestrator Service
 * 
 * Handles the LLM-driven tool-calling loop for search requests.
 * Extracted from recommendationRoutes.ts for better maintainability and testability.
 */

import Groq from 'groq-sdk';
import type { ChatCompletionTool } from 'groq-sdk/resources/chat/completions';
import { SEARCH_MY_NETWORK_TOOL, ASK_MY_NETWORK_TOOL, type AskMyNetworkArgs } from '../config/searchTools';
import { executeStructuredSearch, type StructuredSearchArgs, type StructuredSearchResult } from './structuredSearch';
import {
  formatStructuredResultsForResponse,
  addDistanceLabelsToResults,
  parseToolArguments,
  normalizeStructuredSearchArgs,
  parseAskMyNetworkArgs,
  enqueueAskNetworkRequest,
  type FormattedStructuredResult
} from '../routes/recommendationRoutes';

export type { FormattedStructuredResult };

export interface SearchOrchestratorResult {
  finalMessage: any;
  structuredContext: { raw: StructuredSearchResult; formatted: FormattedStructuredResult[] } | null;
  askNetworkContext: any;
}

export interface SearchOrchestratorOptions {
  userId: string;
  query: string;
  user_lat?: number | null;
  user_lng?: number | null;
  personalDNA?: any;
  groq: Groq;
  systemPrompt: string;
  maxTurns?: number;
}

/**
 * Execute the LLM tool-calling loop for search
 * 
 * @param options - Configuration for the orchestrator
 * @returns Result containing final message, structured context, and ask network context
 */
export async function executeSearchOrchestration(
  options: SearchOrchestratorOptions
): Promise<SearchOrchestratorResult> {
  const {
    userId,
    query,
    user_lat,
    user_lng,
    groq,
    systemPrompt,
    maxTurns = 4
  } = options;

  const FINAL_RESPONSE_TOOL = {
    name: 'final_response',
    description: 'Use this tool when you are ready to return your final JSON response to the user.',
    parameters: {
      type: 'object',
      properties: {
        decision: {
          type: 'string',
          enum: ['show_results', 'no_results', 'ask_network_only'],
          description: 'The final decision on how to present results.'
        },
        headline: {
          type: 'string',
          description: 'A short, conversational summary for the user.'
        },
        show_cards: {
          type: 'boolean',
          description: 'Whether to display result cards in the UI.'
        }
      },
      required: ['decision', 'headline', 'show_cards']
    }
  } as const;

  const tools = [
    {
      type: 'function',
      function: SEARCH_MY_NETWORK_TOOL
    },
    {
      type: 'function',
      function: ASK_MY_NETWORK_TOOL
    },
    {
      type: 'function',
      function: FINAL_RESPONSE_TOOL
    }
  ] satisfies ChatCompletionTool[];

  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: query.trim() }
  ];

  console.log('🤖 [ORCHESTRATOR] Initializing LLM conversation...', {
    systemPromptLength: systemPrompt.length,
    userQueryLength: query.trim().length,
    availableTools: tools.map(t => t.function.name),
    messageCount: messages.length
  });

  // Tool-calling loop state
  let finalMessage: any = null;
  let structuredContext: { raw: StructuredSearchResult; formatted: FormattedStructuredResult[] } | null = null;
  let askNetworkContext: any = null;

  // LLM conversation loop: up to maxTurns turns of tool calling
  for (let turn = 0; turn < maxTurns; turn++) {
    let finalResponseReceived = false;
    console.log(`🔄 [ORCHESTRATOR] Starting LLM turn ${turn + 1}/${maxTurns}...`);
    const llmStartTime = Date.now();
    
    // Retry logic with exponential backoff for LLM API calls
    let completion;
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          temperature: 0,
          tool_choice: 'auto',
          tools,
          messages,
          max_tokens: 1000
        });
        lastError = null;
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRetryable = 
          (error as any)?.status === 429 || // Rate limit
          (error as any)?.status === 500 || // Server error
          (error as any)?.status === 503 || // Service unavailable
          (error as any)?.code === 'ECONNRESET' || // Connection reset
          (error as any)?.code === 'ETIMEDOUT'; // Timeout
        
        if (retry < maxRetries && isRetryable) {
          const backoffMs = Math.min(1000 * Math.pow(2, retry), 10000); // Exponential backoff, max 10s
          console.warn(`   ⚠️ [ORCHESTRATOR] LLM API call failed (attempt ${retry + 1}/${maxRetries + 1}), retrying in ${backoffMs}ms:`, {
            error: lastError.message,
            status: (error as any)?.status,
            code: (error as any)?.code
          });
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // Not retryable or max retries reached
          throw lastError;
        }
      }
    }
    
    if (!completion) {
      throw lastError || new Error('Failed to get LLM completion after retries');
    }

    const llmResponseTime = Date.now() - llmStartTime;
    const choice = completion.choices[0];
    const assistantMessage = choice?.message;
    
    console.log(`📤 [ORCHESTRATOR] LLM response received:`, {
      turn: turn + 1,
      finishReason: choice?.finish_reason,
      responseTimeMs: llmResponseTime,
      hasToolCalls: Boolean(assistantMessage?.tool_calls?.length),
      toolCallsCount: assistantMessage?.tool_calls?.length || 0,
      hasContent: Boolean(assistantMessage?.content),
      contentLength: assistantMessage?.content?.length || 0
    });

    // LLM wants to call tools - process each tool call
    if (assistantMessage?.tool_calls?.length) {
      messages.push(assistantMessage);

      console.log(`🔧 [ORCHESTRATOR] Processing ${assistantMessage.tool_calls.length} tool call(s)...`);
      
      for (const toolCall of assistantMessage.tool_calls) {
        const toolStartTime = Date.now();
        console.log(`   🔨 [TOOL] ${toolCall.function.name} called`, {
          toolCallId: toolCall.id,
          hasArguments: Boolean(toolCall.function.arguments)
        });
        
        try {
          if (toolCall.function.name === 'search_my_network') {
            const rawArgs = parseToolArguments(toolCall.function.arguments);
            const normalizedArgs = normalizeStructuredSearchArgs(rawArgs, user_lat ?? undefined, user_lng ?? undefined);
            console.log('   📋 [TOOL] search_my_network - normalized args:', normalizedArgs);

            const searchStartTime = Date.now();
            const structuredResult = await executeStructuredSearch(userId, normalizedArgs);
            const searchTime = Date.now() - searchStartTime;
            const formatted = formatStructuredResultsForResponse(structuredResult);
            const formattedWithDistance = addDistanceLabelsToResults(formatted, user_lat, user_lng);
            structuredContext = { raw: structuredResult, formatted: formattedWithDistance };
            
            console.log('   ✅ [TOOL] search_my_network - search completed:', {
              searchTimeMs: searchTime,
              resultsFound: formattedWithDistance.length,
              topConfidence: structuredResult.top_confidence,
              usedLocation: structuredResult.used_current_location,
              filtersApplied: structuredResult.metadata.filters_applied
            });

            // Create clear summary for LLM - extract key info from each result
            const resultsSummary = formattedWithDistance.map((result, idx) => {
              const name = result.type === 'place' ? result.place_name : result.service_name;
              const topRec = result.recommendations?.[0];
              const description = topRec?.description || topRec?.title || '';
              const notes = topRec?.content_data?.notes || topRec?.content_data?.quote || '';
              // Combine description and notes, take first 250 chars for context
              const content = [description, notes].filter(Boolean).join(' ').slice(0, 250);
              
              return {
                index: idx + 1,
                name: name || 'Unknown',
                type: result.type,
                relevance_hint: content || 'No description available',
                rating: topRec?.rating || null,
                similarity: Math.round((result.average_similarity || 0) * 100) / 100,
                match_quality: result.average_similarity && result.average_similarity >= 0.8 ? 'high' : 
                             result.average_similarity && result.average_similarity >= 0.6 ? 'moderate' : 'low'
              };
            });

            const confidence = structuredResult.top_confidence || 0;
            const hasResults = formatted.length > 0;
            
            // Build clear confidence message
            let confidenceMessage = '';
            if (confidence >= 0.8 && hasResults) {
              confidenceMessage = '✅ HIGH CONFIDENCE: Strong matches found. You MUST show these results (decision="show_results", show_cards=true).';
            } else if (confidence >= 0.6 && hasResults) {
              confidenceMessage = '✅ MODERATE CONFIDENCE: Relevant results found. Show these results.';
            } else if (hasResults) {
              confidenceMessage = '⚠️ LOW CONFIDENCE: Results found but may be less relevant. Review before showing.';
            } else {
              confidenceMessage = '❌ NO RESULTS: No matches found. Consider asking the network.';
            }

            const toolResponse = {
              type: 'search_results',
              top_confidence: confidence,
              confidence_level: confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'moderate' : 'low',
              confidence_message: confidenceMessage,
              results_count: formatted.length,
              has_results: hasResults,
              used_current_location: structuredResult.used_current_location || false,
              filters_applied: structuredResult.metadata.filters_applied || [],
              results_summary: resultsSummary,
              full_results: formatted
            };

            console.log('   📤 [TOOL] search_my_network - sending response to LLM:', {
              confidenceLevel: toolResponse.confidence_level,
              resultsCount: toolResponse.results_count,
              resultsSummaryCount: resultsSummary.length,
              responseSizeBytes: JSON.stringify(toolResponse).length
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResponse, null, 2) // Pretty print for better LLM readability
            });
            
            const toolTotalTime = Date.now() - toolStartTime;
            console.log(`   ✅ [TOOL] search_my_network - completed in ${toolTotalTime}ms`);
          } else if (toolCall.function.name === 'ask_my_network') {
            const rawArgs = parseToolArguments(toolCall.function.arguments);
            const askArgs = parseAskMyNetworkArgs(rawArgs);
            
            console.log('   📋 [TOOL] ask_my_network - parsed args:', {
              intent: askArgs.intent,
              reason: askArgs.reason,
              urgency: askArgs.urgency,
              preferredCircle: askArgs.preferred_circle
            });
            
            askNetworkContext = await enqueueAskNetworkRequest(userId, askArgs);
            
            console.log('   ✅ [TOOL] ask_my_network - request queued:', {
              ticketId: askNetworkContext.ticket_id,
              status: askNetworkContext.status
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                type: 'ask_network_ack',
                ...askNetworkContext
              })
            });
            
            const toolTotalTime = Date.now() - toolStartTime;
            console.log(`   ✅ [TOOL] ask_my_network - completed in ${toolTotalTime}ms`);
          } else if (toolCall.function.name === 'final_response') {
            const rawArgs = parseToolArguments(toolCall.function.arguments);
            console.log('   📋 [TOOL] final_response payload:', rawArgs);
            finalMessage = {
              role: 'assistant',
              content: JSON.stringify(rawArgs)
            };
            console.log('   ✅ [TOOL] final_response accepted, ending tool loop');
            finalResponseReceived = true;
            break;
          } else {
            console.warn(`   ⚠️ [TOOL] Unknown tool: ${toolCall.function.name}`);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: `Unknown tool ${toolCall.function.name}` })
            });
          }
        } catch (toolError) {
          const toolTotalTime = Date.now() - toolStartTime;
          console.error(`   ❌ [TOOL] ${toolCall.function.name} - error after ${toolTotalTime}ms:`, {
            error: toolError instanceof Error ? toolError.message : 'Unknown error',
            stack: toolError instanceof Error ? toolError.stack : undefined
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              error:
                toolError instanceof Error ? toolError.message : 'Tool execution failed'
            })
          });
        }
      }

      if (finalResponseReceived) {
        break;
      }
      continue; // Continue loop to process tool responses
    }

    // LLM returned final response (no more tool calls)
    console.log(`✅ [ORCHESTRATOR] LLM returned final response (no more tool calls)`);
    finalMessage = assistantMessage;
    break;
  }

  return {
    finalMessage,
    structuredContext,
    askNetworkContext
  };
}
