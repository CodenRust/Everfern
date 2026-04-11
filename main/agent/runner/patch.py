import re

runner_path = 'c:/Users/srini/EverFern-Mono/everfern-desktop/apps/desktop/main/agent/runner.ts'
with open(runner_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import statement
import_replacement = "import { loadSkills, Skill } from './skills-loader';\n  import { parseTextToToolCalls } from './parsers/text-to-tool';"

if 'parseTextToToolCalls' not in content:
    content = content.replace("import { loadSkills, Skill } from './skills-loader';", import_replacement)

# 2. Replace parser block
start_str = '        // Strip markdown code fences \u2014 models often wrap tool calls in ```python or ```bash blocks'
end_str = '            // JSON parse failed \u2014 not a valid JSON narration, ignore\n          }\n        }\n      }'

# Use index to find boundaries
start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    end_idx += len(end_str)
    
    new_parsing_logic = '''        const parserResult = parseTextToToolCalls(textContent, this.tools);
        if (parserResult.toolCalls.length > 0) {
          response.toolCalls = parserResult.toolCalls;
          response.content = parserResult.scrubbedContent;
          response.finishReason = 'tool_calls';
        }
      }'''
      
    content = content[:start_idx] + new_parsing_logic + content[end_idx:]
    
    with open(runner_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Patched runner.ts successfully.')
else:
    print('Failed to find boundary strings in runner.ts')
    print('Start index:', start_idx)
    print('End index:', end_idx)
