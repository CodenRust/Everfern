# Dependency Manager Usage Examples

The Dependency Manager provides real-time dependency graph tracking across the codebase, automatic import statement management, and circular dependency detection.

## Basic Usage

```typescript
import { getDependencyManager } from './dependency-manager';

const manager = getDependencyManager();

// Add files to the dependency graph
manager.addFile('src/utils.ts', `
  export const add = (a: number, b: number) => a + b;
  export const multiply = (a: number, b: number) => a * b;
`);

manager.addFile('src/calculator.ts', `
  import { add, multiply } from './utils';

  export class Calculator {
    sum(a: number, b: number) {
      return add(a, b);
    }

    product(a: number, b: number) {
      return multiply(a, b);
    }
  }
`);

// Get dependencies
const deps = manager.getDependencies('src/calculator.ts');
console.log(deps); // ['src/utils.ts']

// Get dependents
const dependents = manager.getDependents('src/utils.ts');
console.log(dependents); // ['src/calculator.ts']
```

## Detecting Circular Dependencies

```typescript
// Add files with circular dependencies
manager.addFile('src/a.ts', `export const a = 1;`);
manager.addFile('src/b.ts', `export const b = 2;`);

manager.addFile('src/a.ts', `import { b } from './b';\nexport const a = 1;`);
manager.addFile('src/b.ts', `import { a } from './a';\nexport const b = 2;`);

// Detect circular dependencies
const cycles = manager.detectCircularDependencies();
console.log(cycles);
// [
//   {
//     cycle: ['src/a.ts', 'src/b.ts', 'src/a.ts'],
//     severity: 'warning',
//     suggestion: 'Consider extracting shared code from src/a.ts and src/b.ts into a separate module.'
//   }
// ]
```

## Handling File Moves

```typescript
// Identify files that need updates when a file is moved
const filesToUpdate = manager.updateImportsForFileMove(
  'src/utils.ts',
  'src/lib/utils.ts'
);

console.log(filesToUpdate); // ['src/calculator.ts']

// Calculate new import path
const newImportPath = manager.calculateNewImportPath(
  'src/calculator.ts',
  'src/utils.ts',
  'src/lib/utils.ts'
);

console.log(newImportPath); // './lib/utils'
```

## Integration with semanticRename and smartRelocate

The Dependency Manager is designed to work seamlessly with the `semanticRename` and `smartRelocate` tools:

### Using with smartRelocate

```typescript
// When moving a file, the dependency manager can identify affected files
const oldPath = 'src/utils.ts';
const newPath = 'src/lib/utils.ts';

// Get files that import the moved file
const affectedFiles = manager.updateImportsForFileMove(oldPath, newPath);

// Use smartRelocate tool to move the file and update imports automatically
// The tool will handle updating all import statements in affected files
```

### Using with semanticRename

```typescript
// When renaming a symbol, the dependency manager tracks which files use it
const fileWithSymbol = 'src/utils.ts';
const dependents = manager.getDependents(fileWithSymbol);

// Use semanticRename tool to rename the symbol across all dependent files
// The tool will update all references automatically
```

## Getting Dependency Graph Statistics

```typescript
const stats = manager.getStats();

console.log(stats);
// {
//   totalFiles: 10,
//   totalDependencies: 25,
//   circularDependencies: [],
//   orphanedFiles: ['src/unused.ts'],
//   mostDepended: [
//     { file: 'src/utils.ts', count: 5 },
//     { file: 'src/types.ts', count: 3 }
//   ]
// }
```

## Integration with Coding Specialist Agent

The Dependency Manager is automatically available to the Enhanced Coding Specialist Agent and can be used to:

1. **Track imports when creating new files**: Automatically identify required imports
2. **Update imports when refactoring**: Ensure all import statements remain valid
3. **Detect architectural issues**: Identify circular dependencies and suggest refactoring
4. **Optimize import statements**: Remove unused imports and organize import order
5. **Safe refactoring**: Use with semanticRename and smartRelocate for safe code changes

### Example: Creating a New Component

```typescript
import { getDependencyManager } from './dependency-manager';

const manager = getDependencyManager();

// When creating a new component, check what it needs to import
const newComponentPath = 'src/components/UserProfile.tsx';
const newComponentContent = `
  import { User } from '../types';
  import { formatDate } from '../utils';

  export const UserProfile = ({ user }: { user: User }) => {
    return <div>{formatDate(user.createdAt)}</div>;
  };
`;

// Add to dependency graph
manager.addFile(newComponentPath, newComponentContent);

// Verify dependencies are tracked
const deps = manager.getDependencies(newComponentPath);
console.log(deps); // ['src/types.ts', 'src/utils.ts']
```

## Best Practices

1. **Add files to the graph as they're created**: Keep the dependency graph up-to-date
2. **Check for circular dependencies regularly**: Run detection after major refactoring
3. **Use with refactoring tools**: Combine with semanticRename and smartRelocate for safe changes
4. **Monitor orphaned files**: Identify and remove unused code
5. **Track most-depended files**: Be careful when modifying heavily-used modules

## API Reference

### Core Methods

- `addFile(filePath: string, content: string)`: Add or update a file in the graph
- `removeFile(filePath: string)`: Remove a file from the graph
- `getDependencies(filePath: string)`: Get files that this file depends on
- `getDependents(filePath: string)`: Get files that depend on this file
- `detectCircularDependencies()`: Find circular dependency cycles
- `getImports(filePath: string)`: Get import statements for a file
- `getExports(filePath: string)`: Get export statements for a file
- `updateImportsForFileMove(oldPath: string, newPath: string)`: Get files to update after move
- `calculateNewImportPath(importingFile: string, oldTargetPath: string, newTargetPath: string)`: Calculate new import path
- `getStats()`: Get dependency graph statistics
- `getAllFiles()`: Get all files in the graph
- `clear()`: Clear the entire graph

### Singleton Access

- `getDependencyManager()`: Get or create the singleton instance
- `resetDependencyManager()`: Reset the singleton (useful for testing)
