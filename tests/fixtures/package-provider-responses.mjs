// Copied inside each isolated installation. Replace only provider I/O; the
// package entry point, SDK, validation, dispatch and services remain real.
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const server = process.env.PACKAGE_FIXTURE_SERVER;
function unexpected() {
  throw new Error("Unexpected offline provider request");
}
if (["canvas", "clickup", "flight"].includes(server)) {
  const { default: axios } = await import("axios");
  axios.defaults.adapter = async (config) => {
    const path = new URL(axios.getUri(config)).pathname;
    if (config.method !== "get") unexpected();
    let data;
    if (server === "canvas" && path === "/api/v1/courses")
      data = [{ id: 42, name: "fixture-success" }];
    else if (server === "clickup" && path === "/api/v2/team")
      data = { teams: [{ id: "42", name: "fixture-success" }] };
    else if (server === "flight" && path === "/air/airlines")
      data = { data: [{ id: "arl_fixture", name: "fixture-success" }] };
    else unexpected();
    return { data, status: 200, statusText: "OK", headers: {}, config };
  };
} else if (server === "jev") {
  let calls = 0;
  globalThis.fetch = async (input, options) => {
    const body = JSON.parse(options.body);
    if (
      String(input) !== "https://ai-gateway.vercel.sh/v4/ai/evaluation-model" ||
      options.method !== "POST" ||
      new Headers(options.headers).get("ai-model-id") !== "typesafe-ai/jev" ||
      body.state !== "fixture-state" ||
      body.questions.ready.instructions !== "fixture-instructions" ||
      JSON.stringify(body.providerOptions) !==
        JSON.stringify({
          gateway: {
            only: ["typesafe-ai"],
            zeroDataRetention: true,
            disallowPromptTraining: true,
          },
        })
    )
      unexpected();
    const mode = process.env.PACKAGE_FIXTURE_JEV_MODE;
    if (["cancel", "eof", "sigterm"].includes(mode) && ++calls === 1) {
      const file = new URL(`./jev-${mode}.json`, import.meta.url);
      writeFileSync(file, JSON.stringify({ started: true, aborted: false }));
      return new Promise((_resolve, reject) =>
        options.signal.addEventListener(
          "abort",
          () => {
            writeFileSync(
              file,
              JSON.stringify({ started: true, aborted: true })
            );
            reject(new Error("private-provider-abort"));
          },
          { once: true }
        )
      );
    }
    if (mode === "unauthorized")
      return new Response("private-provider-body", {
        status: 401,
        headers: { "private-provider-header": "private-provider-value" },
      });
    if (mode === "oversize")
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1048577));
          },
        })
      );
    return new Response(
      JSON.stringify({
        answers: { ready: { type: "boolean", probability: 0.9 } },
        ...(mode === "warning"
          ? {
              warnings: [
                { type: "other", message: "private-provider-warning" },
              ],
            }
          : {}),
      }),
      { headers: { "content-type": "application/json" } }
    );
  };
} else if (server === "salesforce") {
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    if (
      url.pathname !== "/services/data/v59.0/query" ||
      url.searchParams.get("q") !== "SELECT Id, Name FROM Account LIMIT 1" ||
      options.method !== "GET"
    )
      unexpected();
    return new Response(
      JSON.stringify({
        records: [{ Id: "001000000000001AAA", Name: "fixture-success" }],
        done: true,
        totalSize: 1,
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
} else if (server === "elasticsearch") {
  const { Transport } = require("@elastic/elasticsearch");
  Transport.prototype.request = async function (params) {
    if (
      params.method !== "POST" ||
      params.path !== "/fixture/_search" ||
      JSON.stringify(params.body.query) !== '{"match_all":{}}'
    )
      unexpected();
    return {
      took: 1,
      timed_out: false,
      _shards: { total: 1, successful: 1, skipped: 0, failed: 0 },
      hits: {
        total: { value: 1, relation: "eq" },
        max_score: 1,
        hits: [
          {
            _index: "fixture",
            _id: "42",
            _score: 1,
            _source: { name: "fixture-success" },
          },
        ],
      },
    };
  };
} else if (server === "postgresql") {
  const { Pool } = require("pg");
  Pool.prototype.connect = async function () {
    const queries = [];
    return {
      async query(sql) {
        const expected = [
          "BEGIN READ ONLY",
          "SELECT 'fixture-success' AS name",
          "COMMIT",
        ];
        if (sql !== expected[queries.length]) unexpected();
        queries.push(sql);
        return {
          rows: [{ name: "fixture-success" }],
          rowCount: 1,
          fields: [
            {
              name: "name",
              dataTypeID: 25,
              dataTypeSize: -1,
              dataTypeModifier: -1,
            },
          ],
        };
      },
      release(discard) {
        if (discard || queries.length !== 3) unexpected();
        writeFileSync(
          new URL("./provider-cleanup.json", import.meta.url),
          JSON.stringify({ released: true, committed: true })
        );
      },
    };
  };
} else unexpected();
