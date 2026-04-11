import { interrupt, MemorySaver, StateGraph, START, END, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({ val: Annotation<string>() });
const graph = new StateGraph(State)
  .addNode("n1", () => { const f = interrupt("hello"); console.log("resumed with", f); return { val: "1" }; })
  .addEdge(START, "n1")
  .addEdge("n1", END)
  .compile({ checkpointer: new MemorySaver() });

async function run() {
  const config = { configurable: { thread_id: "1" } };
  const res1 = await graph.invoke({ val: "0" }, config);
  console.log("Paused", res1.__interrupt__);
  
  // try resuming
  const Command = (await import("@langchain/langgraph")).Command;
  const res2 = await graph.invoke(new Command({ resume: "world" }), config);
  console.log("Finished", res2);
}
run();
