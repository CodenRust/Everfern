
import { createBrowserUseTool, ChromeExtensionAPI } from './main/agent/tools/browser-use';
import { AIClient } from './main/lib/ai-client';

async function test() {
  console.log('🚀 Starting Browser Use Tool Test...');
  
  // Mock AI Client
  const mockAIClient: any = {
    chat: async (req: any) => {
      console.log('🤖 AI Chat requested:', JSON.stringify(req).substring(0, 200) + '...');
      
      // Provide a sequence of actions to simulate a research task
      if (req.messages[0].content[0].text.includes('PLAN')) {
        return { content: JSON.stringify({ action: 'navigate', url: 'https://www.google.com', reason: 'Start search' }) };
      }
      if (req.messages[0].content[0].text.includes('SEARCH')) {
        return { content: JSON.stringify({ action: 'extract', reason: 'Extracting search results' }) };
      }
      return { content: JSON.stringify({ action: 'done', summary: 'Test research complete', confidence: 0.9 }) };
    }
  };

  const extensionAPI = new ChromeExtensionAPI();
  const tool = createBrowserUseTool(mockAIClient, undefined, extensionAPI);

  console.log('🛠️ Executing tool...');
  const result = await tool.execute({
    query: 'Test research for news discord bots',
    maxSteps: 3
  }, (msg) => console.log(`  [Update] ${msg}`));

  console.log('\n🏁 Test Result:');
  console.log('Success:', result.success);
  if (result.success) {
    console.log('Steps taken:', result.data.steps);
    console.log('Sources visited:', result.data.sourcesVisited);
  } else {
    console.error('Error:', result.error);
    console.error('Output:', result.output);
  }
}

test().catch(err => {
  console.error('❌ Test failed unexpectedly:', err);
  process.exit(1);
});
