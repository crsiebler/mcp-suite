import axios from "axios";
import { CanvasToolRegistry, createCanvasGroups } from "./registry.js";
// Construct definitions without reading credentials, starting MCP or allowing I/O.
const client = axios.create({
  adapter: async () => {
    throw new Error("Catalog cannot make provider requests");
  },
});
export const tools = new CanvasToolRegistry(
  createCanvasGroups(client)
).getToolDefinitions();
